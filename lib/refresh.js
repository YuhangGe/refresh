var fs = require("fs");
var chokidar = require('chokidar');
var conf = null;
var file_watch_table = {};
var socket_table = {};

var $ = {
    log : function(msg) {
        console.log(msg);
    },
    createDelegate : function(instance, func) {
        return function() {
            func.apply(instance, arguments);
        }
    }
};

function read_conf() {
    if(fs.existsSync("./refresh.json")) {
        var ct = fs.readFileSync("./refresh.json", "utf8");
//        $.log(ct);
        conf = JSON.parse(ct);
    } else {
        $.log("refresh.json not found.");
        conf = {
            port : 8090,
            watch : []
        };
    }

    if(typeof conf.watch==='undefined' || (!conf.watch instanceof Array)) {
        $.log("incorrect conf file.");
        process.exit(-1);
    }


}



function parse_conf() {
    var dir_cache = {};
    var _w, w_id, w_r;

    function read_dir(path) {
        if(typeof dir_cache[path]==='undefined') {
            if(fs.existsSync(path) && fs.statSync(path).isDirectory()) {
//            $.log("read dir: "+ path);
                var _dir = [];
                fs.readdirSync(path).forEach(function(item) {
                    var _s = fs.statSync(path+"/"+item);
                    if(_s.isFile()) {
//                    $.log("file: " + path+"/"+item);
//                        $.log(_s.mtime.getTime());
                        _dir.push({
//                            "mtime" : _s.mtime.getTime(),
                            "name" : item,
                            "dir" : path,
                            "type" : "file"
                        });
                    } else if(_s.isDirectory()) {
//                    $.log("dir: " + path + "/" + item);
                        _dir.push({
                            "name" : item,
                            "dir" : path,
                            "type" : "dir"
                        });
                    }
                });
                dir_cache[path] = _dir;
            } else {
                dir_cache[path] = [];
            }
        }
        return dir_cache[path];
    }

    function add_match_file(_d) {
        var _fk = _d.dir+"/"+_d.name;
        var _fv = file_watch_table[_fk];
        if(typeof _fv==='undefined') {
            file_watch_table[_fk] = _fv = [];
            $.log("watching file: " + _fk);
        }
        if(_fv.indexOf(w_id)<0) {
            _fv.push(w_id);
        }
    }
    function match_all(wr, dir_path) {
//        $.log("match all: "+dir_path);
//        $.log(wr);
        var dir_arr = read_dir(dir_path);
        for(var i=0;i<dir_arr.length;i++) {
            var _d = dir_arr[i];
            if(_d.type==='file' && wr.test(_d.name)) {
                add_match_file(_d);
            } else if(_d.type==='dir') {
                match_all(wr, _d.dir+"/"+_d.name);
            }
        }
    }
    function do_match(ws, dir_path, idx, w_id) {
        var dir_arr = read_dir(dir_path), _last = (idx === ws.length-1);
        var _type = _last ? 'file' : 'dir';
        if(!_last && ws[idx]==="**") {
            //如果当前规则是**，表示匹配当前文件夹以及所有子文件夹
            match_all(new RegExp("^"+ws[ws.length-1]+"$"), dir_path, w_id);
            return;
        }
        var cur_r = new RegExp("^" + ws[idx]+"$");

//    $.log("check match: "+ws[idx]);
        for(var i=0;i<dir_arr.length;i++) {
            var _d = dir_arr[i];
            if(_d.type===_type && cur_r.test(_d.name)) {
                if(_last) {
//                    $.log("file match: " + _d.dir+"/"+_d.name);
                    add_match_file(_d);
                } else {
//                $.log("dir match: "+_d.dir+"/"+_d.name);
                    do_match(ws, _d.dir+"/"+_d.name, idx+1, w_id);
                }
            }
        }

    }

    for(var i=0;i<conf.watch.length;i++) {
        _w = conf.watch[i], w_id = _w.id, w_r = _w.rules;
        for(var j=0;j<w_r.length;j++) {
            var ws = w_r[j].split("/");
            if(ws.length===0) {
                return;
            }
            do_match(ws, ".", 0, w_id);
        }

    }
    //conf.watch已经没有作用。删除可能可以回收以节省内存。好吧，其它无所谓的了。
    delete conf.watch;

}

function watch_files() {
    var _wh = function(filename) {
        this.fname = filename;
        this.listener = $.createDelegate(this, this.on_change);
    };
    _wh.prototype = {
        run : function() {
//            var ls = fs.watch(this.fname);
//            ls.on("change", this.listener);
//            $.log("watch: "+this.fname);
            var watcher = chokidar.watch(this.fname)
            watcher.on("change", this.listener).on("error", function(){
                $.log("error when watch file change");
            });
        },
        on_change : function(filename, stats) {
            $.log("file: "+this.fname+" changed.");
//            $.log(filename+" : "+stats.mtime.getTime());
            var id_arr = file_watch_table[this.fname];
            for(var i=0;i<id_arr.length;i++) {
                emit_change(id_arr[i], this.fname);
            }
        }
    }
    for(var filename in file_watch_table) {
        //js 的闭包有些问题，一定要通过new object的方式才能正确处理参数。
        new _wh(filename).run();
    }
}

function listen() {
    var io = require('socket.io').listen(conf.port);
    io.set("log level", 0);


    function _s(socket) {
        this.socket = socket;
        this.id_arr = [];
        socket.on('watch', $.createDelegate(this, this.on_watch));
        socket.on("disconnect", $.createDelegate(this, this.on_disconnect));
    }
    _s.prototype = {
        on_watch : function(data) {
            var id = data.id;
            if(this.id_arr.indexOf(id)>=0) {
                return;
            }
            this.id_arr.push(id);
            var s_arr = socket_table[id];
            if(typeof s_arr === 'undefined') {
                socket_table[id] = s_arr = [];
            }
            s_arr.push(this);
            $.log("add socket: "+s_arr.length);
        },
        on_disconnect : function() {
            for(var i=0;i<this.id_arr.length;i++) {
                var s_arr = socket_table[this.id_arr[i]];
                var idx = s_arr.indexOf(this);
                if(idx>=0) {
                    s_arr.splice(idx, 1);
                    $.log("remove socket: "+s_arr.length);
                }

            }
        },
        on_change : function(id, filename) {
            this.socket.emit("change", {
                id : id,
                filename : filename
            })
        }
    }
    io.sockets.on('connection', function (socket) {
        new _s(socket);
//        $.log(socket_table);
    });
}

function emit_change(id, filename) {
//    $.log(id);
//    $.log(socket_table);

    var s_arr = socket_table[id];
    if(typeof s_arr === 'undefined') {
        return;
    }

    for(var i=0;i<s_arr.length;i++) {
        s_arr[i].on_change(id, filename);
    }
}

(function() {
    read_conf();
    parse_conf();
//    $.log(file_watch_table);
    watch_files();

    listen();

    $.log("refresh now is watching files.");

})();

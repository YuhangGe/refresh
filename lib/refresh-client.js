var refresh = {};



(function() {


    var $ = {
        log : function(msg) {
            console.log(msg);
        },
        extend : function(obj, ext) {
            for(var i in ext) {
                obj[i] = ext[i];
            }
        }
    };

    var host = "http://localhost", port = 8090, socket = null;
    var namespace = "";


    var watch_table = {};

    function default_callback() {
        window.location.reload();
    }

    function on_change(data) {
        var id = data.id, callback = watch_table[id];
        if(typeof callback === 'function') {
            callback(data);
        }
    }

    $.extend(refresh, {
       conf : function(conf) {
            if(typeof conf === 'undefined') {
                return refresh;
            }
            if(typeof conf.port === 'number') {
                port = conf.port;
            }
            if(typeof conf.host === 'string') {
                host = conf.host;
            }
            if(typeof conf.namespace === 'string') {
                namespace = conf.namespace;
            }
           return refresh;
       },
       watch : function(id, callback) {
           if(typeof id === 'undefined') {
               id = "main";
           }
           if(typeof callback !== 'function') {
               callback = default_callback;
           }
           var _w = watch_table[id];
           if(typeof _w !== 'undefined') {
               return refresh;
           }
           if(socket === null) {
               if(typeof io === 'undefined') {
                   alert("error! refresh needs socket.io");
                   return refresh;
               }
               socket = io.connect(host+":"+port +(namespace===""?"":"/"+namespace), {
                   reconnect : false
               });
               socket.on("change", on_change);
               socket.on("disconnect", function() {
//                  alert("refresh sever has crashed.")
                   $.log("refresh sever has crashed.");
               });
           }
           socket.emit("watch", {
               id : id
           });
           watch_table[id] = callback;

           return refresh;
       }
    });
})();
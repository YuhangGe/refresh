refresh
=======

auto reload web pages when files on server changed

Usage
------
First, you need download the source code. Assume that you put the code at directory `dir_of_refresh`.
Then, you need put a refresh configuration file named `refresh.json` to your web project directory.
Finally, run `node dir_of_refresh/lib/refresh.js` on the path of your web project.

Certainly， you also need put script in client file such as `index.html`.
```
<script type="text/javascript" src="http://localhost:8090/socket.io/socket.io.js"></script>
<script type="text/javascript" src="../lib/refresh-client.js"></script>
<script type="text/javascript">
    refresh.watch();
</script>
```


Configuration File
-------
Here is an example configuration file `refresh.json` under `demo/` directory. Its content is:
````
{
	"port" : 8090,
	"watch" : [{
        "id" : "main",
        "rules" : [
            "index.html",
            "css/.+\\.css",
            "js/.+\\.js",
            "test/**/.+"
        ]
    },{
        "id" : "test",
        "rules" : [
            "test.html",
            "test/.+/.+"
        ]
    }]
}
`````

The watch rules indicate files to be watched. We use javascript regular expression to describe the rule. A special rule notation is `**`, it means files under current directory and all child directories.

API
------
`refresh.conf({host:"", port:})`

configure the host and port. default host is "http://localhost", default port is 8090

`refresh.watch(id, callback)`
  
watch files. default id is "main", default callback just reload current page.

example
```
<script type="text/javascript">
    refresh.conf({
        host:'http://localhost',
        port:8090
    }).watch("test", function(data){
        console.log(data.id);
        console.log(data.filename);
    });
</script>
````


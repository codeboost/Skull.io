(function() {
  var express;

  express = require('express');

  exports.init = function(viewsDir) {
    var app;
    app = express.createServer();
    app.configure(function() {
      app.use(express.bodyParser());
      app.use(express.cookieParser());
      app.use(express.static(__dirname));
      app.use(express.session({
        secret: '$#$wt00ne%%',
        store: new express.session.MemoryStore
      }));
      app.set('views', viewsDir);
      app.set('view engine', 'jade');
      return app.set('view options', {
        layout: false
      });
    });
    app.get('/', function(req, res) {
      console.log('Connect.sid ', req.cookies['connect.sid']);
      return res.render('index');
    });
    return app;
  };

}).call(this);

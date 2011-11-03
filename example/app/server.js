(function() {
  var SkullApp, app, express, port, skullApp;
  express = require('express');
  SkullApp = require('./example').App;
  app = express.createServer();
  app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.static(__dirname));
    app.use(express.session({
      secret: '$#$wt00ne%%',
      store: new express.session.MemoryStore
    }));
    app.set('views', __dirname);
    app.set('view engine', 'jade');
    return app.set('view options', {
      layout: false
    });
  });
  app.get('/', function(req, res) {
    console.log('Connect.sid ', req.cookies['connect.sid']);
    return res.render('index');
  });
  port = process.env.PORT || 4000;
  skullApp = new SkullApp;
  skullApp.createServer(app);
  app.listen(port, function() {
    return console.info('Server started on port ' + port);
  });
}).call(this);

(function() {
  var App, Comments, MemoryModel, Posts, Skull, express, expressApp, io, port, skullApp, _;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  Skull = require('../../lib/skull-server');
  io = require('socket.io');
  _ = require('underscore');
  express = require('express');
  MemoryModel = (function() {
    __extends(MemoryModel, Skull.Model);
    MemoryModel.prototype.name = '/untitled';
    function MemoryModel() {
      MemoryModel.__super__.constructor.apply(this, arguments);
      this.id = 0;
      this.items = {};
    }
    MemoryModel.prototype.create = function(data, callback, socket) {
      data.id = this.id++;
      this.items[data.id] = data;
      if (typeof callback === "function") {
        callback(null, data);
      }
      return this.emit('create', data, socket);
    };
    MemoryModel.prototype.update = function(data, callback, socket) {
      var existing;
      existing = this.items[data.id];
      if (!existing) {
        return callback("item doesn't exist");
      }
      this.items[data.id] = data;
      if (typeof callback === "function") {
        callback(null, data);
      }
      return this.emit('update', data, socket);
    };
    MemoryModel.prototype["delete"] = function(data, callback, socket) {
      var existing;
      existing = this.items[data.id];
      if (!existing) {
        return callback("item doesn't exist");
      }
      delete this.items[data.id];
      if (typeof callback === "function") {
        callback(null, data);
      }
      return this.emit('delete', data, socket);
    };
    MemoryModel.prototype.read = function(filter, callback, socket) {
      var items;
      items = _.toArray(this.items);
      console.dir(items);
      return callback(null, items);
    };
    return MemoryModel;
  })();
  Posts = (function() {
    __extends(Posts, MemoryModel);
    Posts.prototype.name = '/posts';
    function Posts() {
      var item, items, _i, _len;
      Posts.__super__.constructor.apply(this, arguments);
      this.id = 1;
      items = [
        {
          id: 1,
          title: 'One post',
          text: 'This is the first item'
        }, {
          id: 2,
          title: 'Second post',
          text: 'This is the text for second post'
        }, {
          id: 3,
          title: 'Third post',
          text: 'This is the text for third post'
        }
      ];
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        this.create(item, null, null);
      }
    }
    return Posts;
  })();
  Comments = (function() {
    __extends(Comments, MemoryModel);
    Comments.prototype.name = '/post-comments';
    function Comments() {
      var item, items, _i, _len;
      Comments.__super__.constructor.apply(this, arguments);
      this.id = 1;
      items = [
        {
          post_id: 1,
          author: 'Hoh',
          text: 'The quick brown'
        }, {
          post_id: 1,
          author: 'Borba',
          text: 'Krala marla bumu kum'
        }, {
          post_id: 2,
          author: 'Juck',
          text: 'Kisi puck, pomada nada'
        }, {
          post_id: 3,
          author: 'JC',
          text: 'Musto rusto klomo dum, akaba mara ?'
        }
      ];
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        this.create(item, null, null);
      }
    }
    Comments.prototype.read = function(filter, callback, socket) {
      var items;
      console.log('Comments read. Filter = %j', filter);
      items = _.toArray(this.items);
      items = _.filter(items, __bind(function(item) {
        return this.matchFilter(filter, item);
      }, this));
      console.dir(items);
      return callback(null, items);
    };
    return Comments;
  })();
  App = (function() {
    function App(app) {
      this.io = io.listen(app);
      this.skullServer = new Skull.Server(this.io);
      this.app = this.skullServer.of('/app');
      this.app.addModel(new Posts());
      this.app.addModel(new Comments());
    }
    return App;
  })();
  expressApp = require('../express-core').init(__dirname);
  skullApp = new App(expressApp);
  port = 4000;
  expressApp.listen(port, function() {
    return console.info('Server started on port ' + port);
  });
}).call(this);

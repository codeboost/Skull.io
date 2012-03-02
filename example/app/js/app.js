(function() {
  var __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  _.templateSettings = {
    escape: /\{\{(.+?)\}\}/g,
    interpolate: /\{\-\{(.+?)\}\}/g,
    evaluate: /\{\=\{(.+?)\}\}/g
  };

  $(function() {
    var ImageModel, ImageView, OneItemView, Skull, TodoCollection, TodoItem, TodoView, UserSettings, UserView, sio;
    Skull = window.Skull;
    TodoItem = (function(_super) {

      __extends(TodoItem, _super);

      function TodoItem() {
        TodoItem.__super__.constructor.apply(this, arguments);
      }

      TodoItem.prototype.initialize = function() {
        var _this = this;
        return this.bind('remove', function() {
          if (_this.view) return _this.view.remove();
        });
      };

      return TodoItem;

    })(Skull.Model);
    TodoCollection = (function(_super) {

      __extends(TodoCollection, _super);

      function TodoCollection() {
        TodoCollection.__super__.constructor.apply(this, arguments);
      }

      TodoCollection.prototype.url = '/todos';

      TodoCollection.prototype.model = TodoItem;

      return TodoCollection;

    })(Skull.Collection);
    OneItemView = (function(_super) {

      __extends(OneItemView, _super);

      function OneItemView() {
        this.render = __bind(this.render, this);
        this.startEdit = __bind(this.startEdit, this);
        this.titleClicked = __bind(this.titleClicked, this);
        this.done = __bind(this.done, this);
        OneItemView.__super__.constructor.apply(this, arguments);
      }

      OneItemView.prototype.template = _.template($('#one-todo-item').html());

      OneItemView.prototype.tagName = 'li';

      OneItemView.prototype.events = {
        'click .title': 'titleClicked',
        'change [name=done]': 'done'
      };

      OneItemView.prototype.initialize = function() {
        var _this = this;
        this.model.view = this;
        this.model.bind('change', this.render);
        this.model.bind('locked', function(lockedByMe) {
          if (lockedByMe) return;
          $(_this.el).addClass('locked');
          return _this.$('[name=done]').attr('disabled', 'disabled');
        });
        return this.model.bind('unlocked', function() {
          _this.$('[name=done]').removeAttr('disabled');
          return $(_this.el).removeClass('locked');
        });
      };

      OneItemView.prototype.done = function() {
        return this.model.save({
          'done': this.$('[name=done]').is(":checked")
        });
      };

      OneItemView.prototype.titleClicked = function() {
        var _this = this;
        return this.model.tryLock('edit', function(err) {
          if (!err) {
            return _this.startEdit();
          } else {
            return alert('Lock error');
          }
        });
      };

      OneItemView.prototype.startEdit = function() {
        var input, title,
          _this = this;
        title = this.$('.title');
        input = this.$('.edit-title');
        title.hide();
        return input.show().unbind().blur(function() {
          input.hide();
          _this.$('.title').show();
          return _this.model.unlock();
        }).keyup(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(input.val());
            if (text.length) {
              return _this.model.save({
                title: text
              });
            }
          }
        }).focus().val(this.model.get('title'));
      };

      OneItemView.prototype.render = function() {
        $(this.el).html(this.template({
          item: this.model.toJSON()
        }));
        if (this.model.get('done')) {
          this.$('[name=done]').attr('checked', 'checked');
        }
        return this;
      };

      return OneItemView;

    })(Backbone.View);
    TodoView = (function(_super) {

      __extends(TodoView, _super);

      function TodoView() {
        this.addOne = __bind(this.addOne, this);
        this.addAll = __bind(this.addAll, this);
        this.changed = __bind(this.changed, this);
        TodoView.__super__.constructor.apply(this, arguments);
      }

      TodoView.prototype.initialize = function() {
        var _this = this;
        this.collection.bind('add', this.addOne);
        this.collection.bind('reset', this.addAll);
        this.collection.bind('all', this.changed);
        this.collection.fetch();
        this.list = this.$('.todos');
        this.input = this.$('[name=new-item]');
        this.input.keyup(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(_this.input.val());
            if (text.length) {
              _this.collection.create({
                title: _this.input.val(),
                duration: 0
              });
              return _this.input.val('');
            }
          }
        });
        this.clear = this.$('.clear-completed');
        this.clear.click(function() {
          return _this.collection.each(function(item) {
            if (item.get('done')) return item.destroy();
          });
        });
        return this.changed();
      };

      TodoView.prototype.changed = function() {
        var showDelete;
        showDelete = this.collection.any(function(item) {
          return item.get('done');
        });
        return this.clear.css('visibility', showDelete ? 'visible' : 'hidden');
      };

      TodoView.prototype.addAll = function() {
        return this.collection.each(this.addOne);
      };

      TodoView.prototype.addOne = function(model) {
        var view;
        view = new OneItemView({
          model: model
        });
        return this.list.append(view.render().el);
      };

      return TodoView;

    })(Backbone.View);
    ImageModel = (function(_super) {

      __extends(ImageModel, _super);

      function ImageModel() {
        ImageModel.__super__.constructor.apply(this, arguments);
      }

      ImageModel.prototype.url = '/image';

      ImageModel.prototype.validate = function(data) {
        if (!/^(http:\/\/|https:\/\/|www.)([\w]+)(.[\w]+){1,2}$/.test(data.url)) {
          return 'Invalid URL';
        }
      };

      return ImageModel;

    })(Skull.Model);
    ImageView = (function(_super) {

      __extends(ImageView, _super);

      function ImageView() {
        this.render = __bind(this.render, this);
        ImageView.__super__.constructor.apply(this, arguments);
      }

      ImageView.prototype.el = $('#app2');

      ImageView.prototype.initialize = function() {
        var _this = this;
        this.model.bind('change', this.render);
        this.model.bind('error', function(msg) {
          return alert(msg);
        });
        this.model.bind('locked', function(lockedByMe) {
          if (!lockedByMe) return _this.el.addClass('locked');
        });
        this.model.bind('unlocked', function() {
          return _this.el.removeClass('locked');
        });
        this.input = this.$('[name=url]');
        this.model.fetch();
        return this.input.keyup(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(_this.input.val());
            return _this.model.save({
              url: text
            });
          }
        }).click(function() {
          return _this.model.tryLock('edit', function(err) {
            if (err === null) return _this.input.removeAttr('readonly').focus();
          });
        }).blur(function() {
          return _this.model.unlock(function() {
            return _this.input.attr('readonly', 'readonly');
          });
        });
      };

      ImageView.prototype.render = function() {
        var url;
        url = this.model.get('url');
        this.input.val(url).blur();
        return this.$('.image img').attr('src', url);
      };

      return ImageView;

    })(Backbone.View);
    UserSettings = (function(_super) {

      __extends(UserSettings, _super);

      function UserSettings() {
        UserSettings.__super__.constructor.apply(this, arguments);
      }

      UserSettings.prototype.url = '/mySettings';

      return UserSettings;

    })(Skull.Model);
    UserView = (function(_super) {

      __extends(UserView, _super);

      function UserView() {
        this.render = __bind(this.render, this);
        this.hideEdit = __bind(this.hideEdit, this);
        this.showEdit = __bind(this.showEdit, this);
        UserView.__super__.constructor.apply(this, arguments);
      }

      UserView.prototype.el = $('.settings');

      UserView.prototype.initialize = function() {
        var input,
          _this = this;
        this.model.bind('change', this.render);
        this.$('.user-name').click(this.showEdit);
        input = this.$('.user-name-edit');
        input.blur(this.hideEdit).keyup(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(input.val());
            if (text.length) {
              _this.model.save({
                name: text
              });
            }
            return _this.hideEdit();
          }
        });
        return this.model.fetch();
      };

      UserView.prototype.showEdit = function() {
        this.$('.user-name').hide();
        return this.$('.user-name-edit').val(this.model.get('name')).show().focus();
      };

      UserView.prototype.hideEdit = function() {
        this.$('.user-name-edit').hide();
        return this.$('.user-name').show();
      };

      UserView.prototype.render = function() {
        return this.$('.user-name').text(this.model.get('name'));
      };

      return UserView;

    })(Backbone.View);
    sio = io.connect();
    return sio.on('connect', function() {
      var app, clientNS, globalNS, imgView, models, userSettings, userView;
      console.log('Connected to server');
      clientNS = Skull.createClient(sio.of('/app'));
      globalNS = Skull.createClient(sio.of('/global'));
      models = {};
      models['todos'] = clientNS.addModel(new TodoCollection);
      models['image'] = clientNS.addModel(new ImageModel);
      userSettings = globalNS.addModel(new UserSettings);
      app = new TodoView({
        collection: models['todos'],
        el: $('#app')
      });
      imgView = new ImageView({
        model: models['image'],
        el: $('#app2')
      });
      return userView = new UserView({
        model: userSettings
      });
    });
  });

}).call(this);

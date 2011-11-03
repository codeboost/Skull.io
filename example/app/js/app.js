(function() {
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  _.templateSettings = {
    escape: /\{\{(.+?)\}\}/g,
    interpolate: /\{\-\{(.+?)\}\}/g,
    evaluate: /\{\=\{(.+?)\}\}/g
  };
  $(function() {
    var ImageModel, ImageView, OneItemView, Skull, TodoCollection, TodoItem, TodoView, UserSettings, UserView, sio;
    Skull = require('skull');
    TodoItem = (function() {
      __extends(TodoItem, Skull.Model);
      function TodoItem() {
        TodoItem.__super__.constructor.apply(this, arguments);
      }
      TodoItem.prototype.initialize = function() {
        return this.bind('remove', __bind(function() {
          if (this.view) {
            return this.view.remove();
          }
        }, this));
      };
      return TodoItem;
    })();
    TodoCollection = (function() {
      __extends(TodoCollection, Skull.Collection);
      function TodoCollection() {
        TodoCollection.__super__.constructor.apply(this, arguments);
      }
      TodoCollection.prototype.url = '/todos';
      TodoCollection.prototype.model = TodoItem;
      return TodoCollection;
    })();
    OneItemView = (function() {
      __extends(OneItemView, Backbone.View);
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
        this.model.view = this;
        this.model.bind('change', this.render);
        this.model.bind('locked', __bind(function(lockedByMe) {
          if (lockedByMe) {
            return;
          }
          $(this.el).addClass('locked');
          return this.$('[name=done]').attr('disabled', 'disabled');
        }, this));
        return this.model.bind('unlocked', __bind(function() {
          this.$('[name=done]').removeAttr('disabled');
          return $(this.el).removeClass('locked');
        }, this));
      };
      OneItemView.prototype.done = function() {
        return this.model.save({
          'done': this.$('[name=done]').is(":checked")
        });
      };
      OneItemView.prototype.titleClicked = function() {
        return this.model.tryLock('edit', __bind(function(err) {
          if (!err) {
            return this.startEdit();
          } else {
            return alert('Lock error');
          }
        }, this));
      };
      OneItemView.prototype.startEdit = function() {
        var input, title;
        title = this.$('.title');
        input = this.$('.edit-title');
        title.hide();
        return input.show().unbind().blur(__bind(function() {
          input.hide();
          this.$('.title').show();
          return this.model.unlock();
        }, this)).keyup(__bind(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(input.val());
            if (text.length) {
              return this.model.save({
                title: text
              });
            }
          }
        }, this)).focus().val(this.model.get('title'));
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
    })();
    TodoView = (function() {
      __extends(TodoView, Backbone.View);
      function TodoView() {
        this.addOne = __bind(this.addOne, this);
        this.addAll = __bind(this.addAll, this);
        this.changed = __bind(this.changed, this);
        TodoView.__super__.constructor.apply(this, arguments);
      }
      TodoView.prototype.initialize = function() {
        this.collection.bind('add', this.addOne);
        this.collection.bind('reset', this.addAll);
        this.collection.bind('all', this.changed);
        this.collection.fetch();
        this.list = this.$('.todos');
        this.input = this.$('[name=new-item]');
        this.input.keyup(__bind(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(this.input.val());
            if (text.length) {
              this.collection.create({
                title: this.input.val(),
                duration: 0
              });
              return this.input.val('');
            }
          }
        }, this));
        this.clear = this.$('.clear-completed');
        this.clear.click(__bind(function() {
          return this.collection.each(function(item) {
            if (item.get('done')) {
              return item.destroy();
            }
          });
        }, this));
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
    })();
    ImageModel = (function() {
      __extends(ImageModel, Skull.Model);
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
    })();
    ImageView = (function() {
      __extends(ImageView, Backbone.View);
      function ImageView() {
        this.render = __bind(this.render, this);
        ImageView.__super__.constructor.apply(this, arguments);
      }
      ImageView.prototype.el = $('#app2');
      ImageView.prototype.initialize = function() {
        this.model.bind('change', this.render);
        this.model.bind('error', __bind(function(msg) {
          return alert(msg);
        }, this));
        this.model.bind('locked', __bind(function(lockedByMe) {
          if (!lockedByMe) {
            return this.el.addClass('locked');
          }
        }, this));
        this.model.bind('unlocked', __bind(function() {
          return this.el.removeClass('locked');
        }, this));
        this.input = this.$('[name=url]');
        this.model.fetch();
        return this.input.keyup(__bind(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(this.input.val());
            return this.model.save({
              url: text
            });
          }
        }, this)).click(__bind(function() {
          return this.model.tryLock('edit', __bind(function(err) {
            if (err === null) {
              return this.input.removeAttr('readonly').focus();
            }
          }, this));
        }, this)).blur(__bind(function() {
          return this.model.unlock(__bind(function() {
            return this.input.attr('readonly', 'readonly');
          }, this));
        }, this));
      };
      ImageView.prototype.render = function() {
        var url;
        url = this.model.get('url');
        this.input.val(url).blur();
        return this.$('.image img').attr('src', url);
      };
      return ImageView;
    })();
    UserSettings = (function() {
      __extends(UserSettings, Skull.Model);
      function UserSettings() {
        UserSettings.__super__.constructor.apply(this, arguments);
      }
      UserSettings.prototype.url = '/mySettings';
      return UserSettings;
    })();
    UserView = (function() {
      __extends(UserView, Backbone.View);
      function UserView() {
        this.render = __bind(this.render, this);
        this.hideEdit = __bind(this.hideEdit, this);
        this.showEdit = __bind(this.showEdit, this);
        UserView.__super__.constructor.apply(this, arguments);
      }
      UserView.prototype.el = $('.settings');
      UserView.prototype.initialize = function() {
        var input;
        this.model.bind('change', this.render);
        this.$('.user-name').click(this.showEdit);
        input = this.$('.user-name-edit');
        input.blur(this.hideEdit).keyup(__bind(function(e) {
          var text;
          if (e.keyCode === 13) {
            text = $.trim(input.val());
            if (text.length) {
              this.model.save({
                name: text
              });
            }
            return this.hideEdit();
          }
        }, this));
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
    })();
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

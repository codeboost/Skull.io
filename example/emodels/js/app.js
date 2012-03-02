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
    var AppRouter, Comment, Comments, DetailViewOfPost, ListOfPosts, Post, Skull, ViewOfCollection, ViewOfComment, ViewOfComments, ViewOfModel, ViewOfOnePost, ViewOfPosts, g_Posts, sio;
    Skull = window.Skull;
    g_Posts = null;
    Comment = (function(_super) {

      __extends(Comment, _super);

      function Comment() {
        Comment.__super__.constructor.apply(this, arguments);
      }

      return Comment;

    })(Skull.Model);
    Comments = (function(_super) {

      __extends(Comments, _super);

      function Comments() {
        Comments.__super__.constructor.apply(this, arguments);
      }

      Comments.prototype.url = '/post-comments';

      Comments.prototype.model = Comment;

      return Comments;

    })(Skull.Collection);
    Post = (function(_super) {

      __extends(Post, _super);

      function Post() {
        Post.__super__.constructor.apply(this, arguments);
      }

      Post.prototype.loadComments = function() {
        this.comments = this.addEmbedded(new Comments);
        return this.comments.fetch({
          filter: {
            post_id: this.get('id')
          }
        });
      };

      return Post;

    })(Skull.Model);
    ListOfPosts = (function(_super) {

      __extends(ListOfPosts, _super);

      function ListOfPosts() {
        ListOfPosts.__super__.constructor.apply(this, arguments);
      }

      ListOfPosts.prototype.url = '/posts';

      ListOfPosts.prototype.model = Post;

      return ListOfPosts;

    })(Skull.Collection);
    ViewOfModel = (function(_super) {

      __extends(ViewOfModel, _super);

      function ViewOfModel() {
        ViewOfModel.__super__.constructor.apply(this, arguments);
      }

      ViewOfModel.prototype.tagName = 'li';

      ViewOfModel.prototype.initialize = function() {
        return this.model.bind('change', this.render());
      };

      ViewOfModel.prototype.render = function() {
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
      };

      return ViewOfModel;

    })(Backbone.View);
    ViewOfCollection = (function(_super) {

      __extends(ViewOfCollection, _super);

      function ViewOfCollection() {
        this.addAll = __bind(this.addAll, this);
        this.addOne = __bind(this.addOne, this);
        ViewOfCollection.__super__.constructor.apply(this, arguments);
      }

      ViewOfCollection.prototype.initialize = function() {
        this.collection.bind('reset', this.addAll);
        return this.collection.bind('add', this.addOne);
      };

      ViewOfCollection.prototype.addOne = function(model) {
        var view;
        view = new this.OneItemView({
          model: model
        });
        return $(this.el).append(view.render().el);
      };

      ViewOfCollection.prototype.addAll = function() {
        return this.collection.each(this.addOne);
      };

      return ViewOfCollection;

    })(Backbone.View);
    ViewOfOnePost = (function(_super) {

      __extends(ViewOfOnePost, _super);

      function ViewOfOnePost() {
        ViewOfOnePost.__super__.constructor.apply(this, arguments);
      }

      ViewOfOnePost.prototype.template = _.template($('#one-post').html());

      return ViewOfOnePost;

    })(ViewOfModel);
    ViewOfPosts = (function(_super) {

      __extends(ViewOfPosts, _super);

      function ViewOfPosts() {
        ViewOfPosts.__super__.constructor.apply(this, arguments);
      }

      ViewOfPosts.prototype.OneItemView = ViewOfOnePost;

      ViewOfPosts.prototype.initialize = function() {
        ViewOfPosts.__super__.initialize.apply(this, arguments);
        return this.collection.fetch();
      };

      return ViewOfPosts;

    })(ViewOfCollection);
    ViewOfComment = (function(_super) {

      __extends(ViewOfComment, _super);

      function ViewOfComment() {
        ViewOfComment.__super__.constructor.apply(this, arguments);
      }

      ViewOfComment.prototype.template = _.template($('#one-comment').html());

      return ViewOfComment;

    })(ViewOfModel);
    ViewOfComments = (function(_super) {

      __extends(ViewOfComments, _super);

      function ViewOfComments() {
        ViewOfComments.__super__.constructor.apply(this, arguments);
      }

      ViewOfComments.prototype.tagName = 'ul';

      ViewOfComments.prototype.OneItemView = ViewOfComment;

      return ViewOfComments;

    })(ViewOfCollection);
    DetailViewOfPost = (function(_super) {

      __extends(DetailViewOfPost, _super);

      function DetailViewOfPost() {
        this.render = __bind(this.render, this);
        DetailViewOfPost.__super__.constructor.apply(this, arguments);
      }

      DetailViewOfPost.prototype.template = _.template($('#post-detail-template').html());

      DetailViewOfPost.prototype.events = {
        'click .btn': 'submitComment'
      };

      DetailViewOfPost.prototype.initialize = function() {
        this.model.bind('change', this.render);
        this.model.loadComments();
        return this.commentsView = new ViewOfComments({
          collection: this.model.comments
        });
      };

      DetailViewOfPost.prototype.submitComment = function() {
        return this.commentsView.collection.create({
          author: this.$('[name=author]').val(),
          text: this.$('[name=text]').val(),
          post_id: this.model.get('id')
        });
      };

      DetailViewOfPost.prototype.render = function() {
        $(this.el).html(this.template(this.model.toJSON()));
        this.$('.comments').append(this.commentsView.el);
        return this;
      };

      return DetailViewOfPost;

    })(Backbone.View);
    AppRouter = (function(_super) {

      __extends(AppRouter, _super);

      function AppRouter() {
        AppRouter.__super__.constructor.apply(this, arguments);
      }

      AppRouter.prototype.routes = {
        'post/:id': 'showPostDetails'
      };

      AppRouter.prototype.showPostDetails = function(id_post) {
        var postModel;
        if (this.postDetails) this.postDetails.remove();
        postModel = g_Posts.get(id_post);
        this.postDetails = new DetailViewOfPost({
          model: postModel
        });
        return $('#post-detail').append(this.postDetails.render().el);
      };

      return AppRouter;

    })(Backbone.Router);
    sio = io.connect();
    return sio.on('connect', function() {
      var clientNS, viewOfPosts;
      console.log('Connected to server');
      clientNS = Skull.createClient(sio.of('/app'));
      g_Posts = clientNS.addModel(new ListOfPosts);
      viewOfPosts = new ViewOfPosts({
        collection: g_Posts,
        el: $('#posts')
      });
      new AppRouter;
      return Backbone.history.start();
    });
  });

}).call(this);

_.templateSettings = {
  escape : /\{\{(.+?)\}\}/g
	interpolate: /\{\-\{(.+?)\}\}/g
	evaluate: /\{\=\{(.+?)\}\}/g
};

$ ->
	Skull = require 'skull'
	
	g_Posts = null
	
	class Comment extends Skull.Model
	
	class Comments extends Skull.Collection
		url: '/post-comments'
		model: Comment
	
	class Post extends Skull.Model
		loadComments: ->
			@comments = @addEmbedded new Comments 
			@comments.fetch filter: {post_id: @get('id')}
			
	class ListOfPosts extends Skull.Collection
		url: '/posts'
		model: Post

			
	class ViewOfModel extends Backbone.View
		tagName: 'li'

		initialize: ->
			@model.bind 'change', @render()
		
		render: ->
			$(@el).html @template(@model.toJSON())
			@


	class ViewOfCollection extends Backbone.View
		initialize: ->
			@collection.bind 'reset', @addAll
			@collection.bind 'add', @addOne
	
		addOne: (model) =>
			view = new @OneItemView model: model
			$(@el).append view.render().el

		addAll: =>
			@collection.each @addOne

	class ViewOfOnePost extends ViewOfModel
		template: _.template $('#one-post').html()

	class ViewOfPosts extends ViewOfCollection
		OneItemView: ViewOfOnePost
		initialize: ->
			super
			@collection.fetch()


	class ViewOfComment extends ViewOfModel
		template: _.template $('#one-comment').html()
		
	class ViewOfComments extends ViewOfCollection
		tagName: 'ul'
		OneItemView: ViewOfComment
		
			
	class DetailViewOfPost extends Backbone.View
		template: _.template $('#post-detail-template').html()
		events:
			'click .btn': 'submitComment'
			
		initialize: ->
			@model.bind 'change', @render
			@model.loadComments()
			@commentsView = new ViewOfComments 
				collection: @model.comments
			
		submitComment: ->
			@commentsView.collection.create 
				author: @$('[name=author]').val()
				text: @$('[name=text]').val()
				post_id: @model.get 'id'
				
		render: =>
			$(@el).html @template @model.toJSON()
			@$('.comments').append @commentsView.el
			@
			
	class AppRouter extends Backbone.Router
		routes:
			'post/:id': 'showPostDetails'
			
		showPostDetails: (id_post) ->
			@postDetails.remove() if @postDetails 
			
			postModel = g_Posts.get id_post
			@postDetails = new DetailViewOfPost model: postModel 
			$('#post-detail').append @postDetails.render().el


	sio = io.connect()

	sio.on 'connect', ->
		console.log 'Connected to server'

		clientNS = Skull.createClient sio.of('/app')
		g_Posts = clientNS.addModel new ListOfPosts
		
		viewOfPosts = new ViewOfPosts 
			collection: g_Posts
			el: $('#posts')
		
		new AppRouter
		
		Backbone.history.start()



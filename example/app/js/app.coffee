_.templateSettings = {
  escape : /\{\{(.+?)\}\}/g
	interpolate: /\{\-\{(.+?)\}\}/g
	evaluate: /\{\=\{(.+?)\}\}/g
};

$ ->
	
	Skull = require 'skull'
	class TodoItem extends Skull.Model
		initialize: ->
			@bind 'remove', => @view.remove() if @view
		
	class TodoCollection extends Skull.Collection
		url: '/todos'
		model: TodoItem


	class OneItemView extends Backbone.View
		
		template: _.template $('#one-todo-item').html()
		tagName: 'li'
		events:
			'click .title': 'titleClicked'
			'change [name=done]': 'done'
		
		initialize: ->
			@model.view = this
			@model.bind 'change', @render
			@model.bind 'locked', (lockedByMe) => 
				return if lockedByMe
				$(@el).addClass 'locked' 
				@$('[name=done]').attr 'disabled', 'disabled'
				
			@model.bind 'unlocked', => 
				@$('[name=done]').removeAttr 'disabled'
				$(@el).removeClass 'locked'

		done: =>
			@model.save 'done': @$('[name=done]').is(":checked")
			
		titleClicked: =>
			@model.tryLock 'edit', (err) =>
				if not err 
					@startEdit() 
				else
					alert 'Lock error'
			
		startEdit: =>
			title = @$('.title')
			input = @$('.edit-title')

			title.hide()
			input.show().unbind()
			.blur => 
				input.hide()
				@$('.title').show()
				@model.unlock()
				
			.keyup (e) =>
				if (e.keyCode == 13)
					text = $.trim input.val()
					if text.length then @model.save title: text
					#should be re-rendered
			.focus()
			.val @model.get 'title'
					
		render: =>
			$(@el).html @template {item: @model.toJSON()}
			#cannot do this with jade in the template.. 
			@$('[name=done]').attr('checked', 'checked') if @model.get 'done'
			@
		
	class TodoView extends Backbone.View
		initialize: ->
			@collection.bind 'add', @addOne
			@collection.bind 'reset', @addAll
			@collection.bind 'all', @changed
			@collection.fetch()
			@list = @$ '.todos'
			@input = @$('[name=new-item]')
			@input.keyup (e) =>
				if e.keyCode == 13 
					text = $.trim @input.val()
					if text.length
						@collection.create {title: @input.val(), duration: 0}
						@input.val ''
						
			@clear = @$('.clear-completed')
			
			@clear.click =>
				@collection.each (item) -> 
					item.destroy() if item.get 'done'
			
			@changed()
			
		changed: =>
			showDelete = @collection.any (item) -> item.get 'done'
			@clear.css 'visibility', if showDelete then 'visible' else 'hidden'
			
		addAll: =>
			@collection.each @addOne
		
		addOne: (model) =>
			view = new OneItemView model: model
			@list.append view.render().el
	
	
	#-----------------------
	
	class ImageModel extends Skull.Model
		url: '/image'
		validate: (data) ->
			if not /^(http:\/\/|https:\/\/|www.)([\w]+)(.[\w]+){1,2}$/.test data.url then return 'Invalid URL'
		
	class ImageView extends Backbone.View
		el: $('#app2')
		
		initialize: ->
			@model.bind 'change', @render
			@model.bind 'error', (msg) => 
				alert msg
			
			@model.bind 'locked', (lockedByMe) =>
				@el.addClass 'locked' unless lockedByMe
				
			@model.bind 'unlocked', =>
				@el.removeClass 'locked'
 				
			@input = @$('[name=url]')
			@model.fetch()
			
			@input
			.keyup (e) =>
				if e.keyCode == 13
					text = $.trim @input.val()
					@model.save url: text
			.click =>
				@model.tryLock 'edit', (err) =>
					@input.removeAttr('readonly').focus() if err == null
			.blur =>
				@model.unlock =>
					@input.attr('readonly', 'readonly')	
				
		
		render: =>
			url = @model.get 'url'
			@input.val(url).blur()
			@$('.image img').attr 'src', url
		
			
	class UserSettings extends Skull.Model
		url: '/mySettings'
			
			
	class UserView extends Backbone.View
		el: $('.settings')
		initialize: ->
			@model.bind 'change', @render
			@$('.user-name').click @showEdit
			input = @$ '.user-name-edit'
			input.blur(@hideEdit)
			.keyup (e) => 
				if e.keyCode == 13
					text = $.trim input.val()
					if text.length then @model.save name: text
					@hideEdit()
			@model.fetch()
					
		showEdit: =>
			@$('.user-name').hide()
			@$('.user-name-edit')
			.val(@model.get 'name')
			.show()
			.focus()

		hideEdit: =>
			@$('.user-name-edit').hide()
			@$('.user-name').show()
			
		render: =>
			@$('.user-name').text @model.get 'name'
			
	
	sio = io.connect()
	
	sio.on 'connect', ->
		console.log 'Connected to server'
		
		clientNS = Skull.createClient sio.of('/app')
		globalNS = Skull.createClient sio.of('/global')
		
		models = {}
		models['todos'] = clientNS.addModel new TodoCollection
		models['image'] = clientNS.addModel new ImageModel
		
		#or just one 
		userSettings = globalNS.addModel new UserSettings
		
		app = new TodoView 
			collection: models['todos']
			el: $ '#app'
		
		imgView = new ImageView 
			model: models['image']
			el: $ '#app2'
			
		userView = new UserView 
			model: userSettings
		
		
		
	
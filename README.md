What is Skull.io ?
------------------

A library which can be used to build distributed realtime interfaces with Backbone.js.
A distributed realtime interface is a UI which can be viewed and edited in realtime by multiple users.

Skull.io is a 'glue' between Backbone Models and server-side models.

It implements namespacing, model locking and 'private' models models.

It is written in CoffeeScript and uses Socket.io.

Installation
-------------

	npm install skull.io
	

Running the example app
-----------------------
	
	./compile.sh 
	node example/app/server.js
	
Now point two or more browsers to http://localhost:4000/ and make some changes. Observe how the changes are synchronized 
between all browsers.

Usage
=====

On the server
-------------
	
	#Set up socket.io as you normally would
	sio = io.listen expressApp 
	
	#create an instance of the Skull.Server
	skullServer = new Skull.Server sio	
	
	#Create a namespace where we'll expose the models
	app = @skullServer.of '/app'
	
	#Expose your models to the world. 
	app.addModel '/todos', new TodoModel()
	app.addModel '/myModel', new MyModel()
	
	#Models must be subclasses of Skull.Model and must implement the methods 'create', 'update', 'delete'. See below.
	
	#See example/app/example.coffee for server-side example

On the client
-------------
	
	#Connect the socket.io
	sio = io.connect()
	
	sio.on 'connect', ->
	
		#Create a client for the namespace '/app'
		app = Skull.createClient sio.of('/app')
	
		#add your models. 
		app.addModel new TodoCollection
		
		#Client-side models/collections must subclass Skull.Model/Collection
		
		#Now all changes are immediately synchronized with the server and broadcast to all connected users
		#See example/app/js/app.coffee for a client-side example 


Server-side models
------------------

Must subclass Skull.Model and must implement the 'create', 'update', 'delete' methods.
See example/app/example.coffee for examples on how to create the models.


Client-side models
------------------

Must subclass Skull.Model. This is the only thing you must do in order to make your models work with Skull.


Private Models
--------------

Private models are models which contain different data depending on the user who accesses them (eg. user settings)
These models must be derived from Skull.SidModel and they act as 'handlers' which forward messages between the client 
and the model for that client.
Check out the example app to see how we've implemented user settings.


License
-------

MIT

Acknowledgments
---------------

This project would have been impossible without the incredible work of the wizards who created CoffeeScript, Backbone.js, 
socket.io, express and of course node.js. For me these guys are an inspiration. 


Locking
-------

There's a problem when more than one client tries to edit a model at the same time.
To avoid the mess, Skull implements a simple model locking mechanism.

Before you allow the user to edit a model, you first have to Lock the model. Then, when the server confirms that 
it has locked the model, you can allow the user to make the edits.
After you've finished editing the model, you should call the model.unlock() method.


Example:
	
	#Use CSS to show that model is locked
	@model.bind 'locked', (lockedByMe, method) -> 
		$(@el).addClass 'locked' unless lockedByMe
	
	#Show item as edit-able if unlocked	
	@model.bind 'unlocked', ->
		$(@el).removeClass 'locked'

	#Lock the model before editing
	@$('.edit').click, => 
		@model.tryLock 'edit', (err) ->
			if err == null
				#show the edit controls
				@$('input')
				.show()
				...
			else
				alert 'Lock failed: ', err #or something like this
	
	#Unlock the model if user cancels edit, eg:
	@$('input').blur => @model.unlock()

	#Delete also requires lock - another user might be editing
	@$('.delete').click, =>
		@model.tryLock 'delete', (result) ->
			@model.destroy() if result == null
			
	
API
		
	model.tryLock [method], [callback]

method - String which describes why you want to lock the model. 
This string will be passed back with the 'locked' event.

callback - if present, the callback receives an err parameter. If null, the operation was successful.
If callback is omitted, the model will receive the 'locked' event with lockedByMe set to true.

	model.unlock() 

Unlocks the model if locked by current user. It is safe to call this method even if the model is not locked 
and even if the model is locked by someone else. 

	model.isLocked [Read only]
	
Boolean which is true if the model is locked on the server

	model.isLockedByMe [Read only]
	
Boolean which is true when current user is holding the lock.

	model.lockinfo [Read only]
	
Contains information about the lock, specifically the user who holds the lock.














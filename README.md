What is Skull.io ?
------------------

A library which can be used to build distributed realtime interfaces with Backbone.js.
A distributed realtime interface is a UI which can be viewed and edited in realtime by multiple users.

Skull.io is a 'glue' between Backbone Models and server-side models.

It implements namespacing, model locking, 'private' models and filtering.

It is written in CoffeeScript and uses Socket.io.

Installation
-------------

	npm install skull.io

To instal dependencies:

	npm install 
	

Running the examples
-----------------------
	
	coffee example/app/index
or
	
	coffee example/emodels/index	
	
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

Must subclass Skull.Model and must implement the 'create', 'update', 'delete' and 'read' methods.
See example/app/index.coffee for examples on how to create the models.

A method has the following signature and implementation:

	create: (data, callback, socket) ->
		#save the data to the database or whatever
		
		#notify the initiating user that the action succeeded
		callback null, data
		
		#emit the 'create' event. Skull will automatically broadcast this event to all other connected users. 
		@emit 'create', data, socket

		#The last parameter is the socket which initiated the action. If omitted, the event is sent to all 
		#users in the namespace. 


A model may also implement 'broadcast' and 'clientCommand' methods.

The 'broadcast' event is used to notify other users of something. It usually doesn't involve changing the model's data.
Client models will receive the 'server-broadcast' event, which you can bind to.
This server-side snippet will just forward the event to all clients.

	broadcast: (data, callback, socket) ->
		callback null, data
		@emit 'broadcast', data, socket

	#client-side
	@model.on 'server-broadcast', (data) -> alert(data)
	
The 'clientCommand' event is, well, a client command sent to the server. Other clients will not receive this event.
For instance:

	#client side
	@model.emitCommand 'downloadFile', {url: 'http://www.google.com/'}, (err) -> alert('file downloaded') if err == null
	
	#server side model
	clientCommand: (data, callback, socket) ->
		#data._command is the command sent by the client
		switch data._command 
			when 'downloadFile' then @download(data.url, callback) 



Client-side models
------------------

Must subclass Skull.Model. This is the only thing you must do in order to make your models work with Skull.


Private Models
--------------

Private models are models which contain different data depending on the user who accesses them (eg. user settings).
In your server-side code, these models must be derived from Skull.SidModel and they act as 'dispatchers' which forward messages between the client and the specific model for that client.

Check out *examples/app* to see how user settings are implemented there.


Locking
-------
Model locking is used to handle multiple users trying to change the same model at the same time.

The idea:

Before a model can be edited, call model.tryLock() on the client side. When the server confirms the lock, show the edit controls.
Then call model.save() to commit the changes to the server. This will also unlock the model.
If user cancels edit, call model.unlock(). 

model.tryLock() may fail if another user is currently editing (holding the lock). In this case, the err argument of the callback will 
be non-null.

Models are automatically unlocked when the socket which holds the lock disconnects.


Locking works on Skull.Model and Skull.Collection.


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
				alert 'Lock failed: ', err 
	
	#Unlock the model if user cancels edit, eg:
	@$('input').blur => @model.unlock()

	#Delete also requires lock - another user might be editing
	@$('.delete').click, =>
		@model.tryLock 'delete', (result) ->
			@model.destroy() if result == null
			
See example/app for a working implementation of model locking.
	
Lock API
-------
		
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
	
Contains information about the lock, specifically the user (socket id) that holds the lock.


Filters / Embedded Models
-------------------------

Sometimes you only want to display a subset of the server model data.
Imagine a list of Posts, with each post having multiple comments.

You want to be able to display the comments for one post at a time, however, you also want that 
users who open the same post to see the changes to the comments in real time.

Filtering allows you to fetch only part of the collection and at the same time, allows multiple users
to monitor parts of the model, by using the same filter.

To achieve this, on the client side, you must add a parameter to the fetch call:

	embeddedCollection.fetch filter: {post_id: @parentModel.get 'id'}
	#only comments for current post

And on the server side, you must implement the filtering in the 'read' method of your model:

	read: (filter, callback, socket) ->
		@database.query filter, (err, data) -> callback data, socket

The format of the filter parameter depends on how you want to filter your data. Usually, it contains the id of 
the parent item, but you can implement more advanced filters. To achieve this, override the 'matchFilter' method of your server-side model.

The filter parameter can also be an array. This is useful if you want to display multiple subsets of the data:

	model.fetch filter: [id_post: 1, id_post: 2]


See the example/emodels sample which implements model filtering.
Notice how browsers which display the same post receive update events, while others don't. 


Database
---------

Because of how Backbone is designed, I find that it is more convenient to use a relational database to store your data on the server.
Document stores, like MongoDB, can be used, but it requires you to model your data in a relational way, eg. I found it difficult to 
elegantly use embedded documents/collections with Backbone + Skull.

License
-------

MIT

Acknowledgments
---------------

This project would have been impossible without the incredible work of the wizards who created CoffeeScript, Backbone.js, 
socket.io, express and of course node.js. For me these guys are an inspiration. 

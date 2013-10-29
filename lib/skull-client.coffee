#Skull-client (c) 2011 Braghis Florin (florin@libertv.ro). MIT License

Skull = window.Skull = {}

#return true if the model is an instance of Skull.Model/Collection
Skull.isValidModel = (model) ->
	(typeof model == 'object') and (model instanceof Skull.Model or model instanceof Skull.Collection)
	
#Called when the server has locked the model
#isLocked -> model locked for editing 
#isLockedByMe -> I am the locker, I can edit it, everyone else can't
serverLockModel = (model, lockinfo, silent) ->
	return unless lockinfo and model
	lockedByMe = lockinfo.sid is model.sid()
	model.isLockedByMe = lockedByMe
	model.isLocked = true
	model.lockinfo = lockinfo
	model.trigger 'locked', lockedByMe, lockinfo 

#Called when server has unlocked the model
#Mark it as unlocked and trigger event
serverUnlockModel = (model, lockinfo) ->
	return unless model
	model.isLocked = false
	model.isLockedByMe = false
	delete model.lockinfo
	model.trigger 'unlocked' 
	

#Backbone.Model and Backbone.Collection CRUD methods have slightly different semantics
#These Helpers are an attempt to unify them 

#Helper which calls the appropirate methods on the Backbone.Model objects
class ModelHelper 
	constructor: (@model, @name) ->
		if not @model instanceof Skull.Model then throw 'Skull.Model expected'

	#received a 'create' notification
	create: (data) -> 
		@model.collection?.create data
		#if there's no collection, create doesn't make sense on an existing model?
	
	#received an 'update' notification
	update: (data) ->
		@model.set data
	
	#received a 'delete' notification
	delete: -> 
		@model.destroy()
	
	#received a lock notification
	lock: (lockinfo) ->
		serverLockModel @model, lockinfo

	#received an unlock notification
	unlock: (lockinfo) ->
		serverUnlockModel @model, lockinfo

	#received a broadcast 
	broadcast: (data) ->
		@model.trigger 'server-broadcast', data
		
#Helper which calls appropriate methods on the Backbone.Collection
class CollectionHelper
	constructor: (@collection, @name) ->
		if not @collection instanceof Skull.Collection then throw 'Skull.Collection expected'
		
	create: (data) ->
		id = data[Backbone.Model::idAttribute]
		if id
			model = @collection.get id
			if model
				model.set data 
				return
		@collection.add data

	update: (data) ->
		id = data[Backbone.Model::idAttribute]
		model = @collection.get id if id
		model?.set(data)
	
	delete: (data) ->
		id = data[Backbone.Model::idAttribute]
		model = @collection.get id if id
		@collection.remove model if model
		
	lock: (lockinfo) ->
		id = lockinfo[Backbone.Model::idAttribute]
		model = @collection.get id if id
		serverLockModel model, lockinfo if model
	
	unlock: (lockinfo) ->
		id = lockinfo[Backbone.Model::idAttribute]
		model = @collection.get id if id
		serverUnlockModel model, lockinfo if model	
	
	broadcast: (data) ->
		@collection.trigger 'server-broadcast', data


#The app can have multiple 'Namespaces', eg. Categories of models/collection
#Here the 'namespace' capability of socket.io is used, which creates a 'virtual socket' for every namespace.

#If on the server you created a namespace:
#	appNS = @skullServer.of '/app'

#On the client you would use:
#appNS = Skull.createClient sio.of('/app')

#You can then add your models to that namespace:
#appNS.addModel myModel, 'someName'


#This implements a Namespace connection between the client and the server.
class SkullClient
	constructor: (@socket, @clientName) ->
		@models = {}
		@sid = @socket.socket.sessionid

		#Add a handler for every event we receive on the socket.
		@addHandler eventName for eventName in ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast']
	
	#Add a handler to handle an event from the socket.
	#The event received has the following arguments:
	#eventName - create, update, delete, lock, unlock...
	#modelName - the model name (added by addModel model, name, eg. '/messages')
	#eventData - the data associated with the event
	addHandler: (eventName) ->
		@socket.on eventName, (modelName, data) =>
			console.log 'Skull: Socket %s, %s', eventName, modelName
			model = @models[modelName]
			#model here is either a ModelHelper or CollectionHelper
			#Call one of the CRUD methods on the helper which in turn will forward the data to the Backbone.Model or Backbone.Collection
			model?[eventName]?(data)
			
	#Register a model with the server. Each client-side model must have a corresponding server-side model with the same name.
	#After adding the model, events triggered by the model will be broadcast to the same model of other clients 
	addModel: (model, name) ->
		#guard against further exceptions if model isn't a Skull.Model/Collection
		if not Skull.isValidModel(model) then throw 'Skull.Model or Skull.Collection expected!'
		
		if model instanceof Skull.Collection then Helper = CollectionHelper else Helper = ModelHelper 
		
		name ?= model.name()
		model._skull = this
		model.sync = @sync
		@models[name] = new Helper model, name
		model

	#The modified Backbone.Model.sync method
	#Sends the CRUD events to the server
	sync: (method, model, cbo) =>
		
		name = model.name?() ? model.collection.name?()
		console.log '[Skull] %s: emit %s, %s', @clientName, method, name
		
		methodData = if method == 'read' then cbo.filter 
		methodData ?= model.toJSON()
		
		@socket.emit method, name, methodData, (err, data) ->
			if err == null 
				cbo.success(data)
			else
				cbo.error model

#Create a Skull.Io client
Skull.createClient = (socket) ->
	Skull.clients ?= {}
	Skull.clients[socket.name] = new SkullClient socket, socket.name
	
#Preserve the original Backbone.Sync
Skull.BackboneSync = Backbone.sync

Backbone.sync = (method, model, cbo) ->
	#Try calling model.sync, then model.collection.sync and if both fail, call the original Backbone.Sync
	#This should allow us to have models which use a different sync method
	sync = (model.sync ? model.collection?.sync) ? Skull.BackboneSync
	sync?(method, model, cbo)
	
#Extends the Backbone.Model with Skull-specific methods
#which enable locking and broadcasting
class Skull.Model extends Backbone.Model
	isLocked: false
	isLockedByMe: false

	name: -> 
		@collection?.url ? (@url?() ? @url)
		
	setLockInfo: (lockinfo) -> 
		serverLockModel this, lockinfo
		
	sid: ->
		@_skull?.sid ? @collection.sid()
		
	addEmbedded: (model, name) ->
		(@_skull ? @collection._skull).addModel model, name
		
	skullEmit: ->
		emitter = @_skull?.socket ? @collection._skull?.socket
		emitter?.emit.apply emitter, arguments

	tryLock: (action, callback) ->
		callback = action if typeof action == 'function'
		
		#if no callback specified, the model will emit 'locked' or 'lock-failed'
		cb = (err, lockinfo) =>
			if err is null
				serverLockModel this, lockinfo
			else
				@trigger 'lock-failed', lockinfo

			callback? err, lockinfo
	
		lockinfo = {}
		lockinfo[Backbone.Model::idAttribute] = @id
		lockinfo['sid'] = @sid()
		lockinfo['action'] = action
		
		if @isLocked and not @isLockedByMe then return cb 'failed', @lockinfo
		if @isLockedByMe then return cb null, @lockinfo

		@skullEmit 'lock', @name(), lockinfo, cb

	unlock: (callback) ->
		lockinfo = {}
		lockinfo[Backbone.Model::idAttribute] = @id
		lockinfo['sid'] = @sid()

		if @isLocked and not @isLockedByMe then return callback? 'failed', lockinfo
		
		cb = (err, lockinfo) =>
			serverUnlockModel this, lockinfo 
			callback? err, lockinfo
		
		@skullEmit 'unlock', @name(), lockinfo, cb
		
	broadcast: (data, callback) ->
		callback ?= ->
		@skullEmit 'broadcast', @name(), data, callback
		
	emitCommand: (cmd, data, callback) ->
		callback ?= ->
		data ?= {}
		data._command = cmd
		@skullEmit 'clientCommand', @name(), data, callback
		
class Skull.Collection extends Backbone.Collection
	model: Skull.Model

	name: -> 
		@url
		
	sid: -> 
		@_skull.sid
		
	addEmbedded: (model, name) ->
		@_skull.addModel model, name
		
	setLockInfo: (lockinfo) ->	
		return unless lockinfo
		lockinfo = [lockinfo] unless _.isArray lockinfo
		
		for lock in lockinfo
			mdl = @get lock[Backbone.Model.idAttribute]
			serverLockModel mdl, lock if mdl
	
	broadcast: (data, callback) ->
		callback ?= ->
		@_skull.socket.emit 'broadcast', @name(), data, callback
	
	emitCommand: (cmd, data, callback) ->
		callback ?= ->
		data ?= {}
		data._command = cmd
		@_skull.socket.emit 'clientCommand', @name, data, callback
			
	
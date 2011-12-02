#Skull-client (c) 2011 Braghis Florin (florin@libertv.ro). MIT License

window.module?.enter 'skull'
window.Skull = {}

Skull.isValidModel = (model) ->
	(typeof model == 'object') and (model instanceof Skull.Model or model instanceof Skull.Collection)
	
#Called by a server event
#isLocked -> model locked for editing 
#isLockedByMe -> I am the locker, I can edit it, everyone else can't
serverLockModel = (model, lockinfo, silent) ->
	return unless lockinfo and model
	lockedByMe = lockinfo.sid is model.sid()
	model.isLockedByMe = lockedByMe
	model.isLocked = true
	model.lockinfo = lockinfo
	model.trigger 'locked', lockedByMe, lockinfo 

#Server unlocked the model. 
#Mark it as unlocked and trigger event
serverUnlockModel = (model, lockinfo) ->
	return unless model
	model.isLocked = false
	model.isLockedByMe = false
	delete model.lockinfo
	model.trigger 'unlocked' 
	
class ModelHelper 
	constructor: (@model, @name) ->
		if not @model instanceof Skull.Model then throw 'Skull.Model expected'

	create: (data) -> 
		@model.collection?.create data
		#if there's no collection, create doesn't make sense on an existing model?
		
	update: (data) ->
		@model.set data
	
	delete: -> 
		@model.destroy()
		
	lock: (lockinfo) ->
		serverLockModel @model, lockinfo
		
	unlock: (lockinfo) ->
		serverUnlockModel @model, lockinfo
	
	broadcast: (data) ->
		@model.trigger 'server-broadcast', data
		
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
	
class SkullClient
	constructor: (@socket, @clientName) ->
		@models = {}
		@sid = @socket.socket.sessionid
		@addHandler eventName for eventName in ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast']
	
	addHandler: (eventName) ->
		@socket.on eventName, (modelName, data) =>
			console.log 'Skull: Socket %s, %s', eventName, modelName
			model = @models[modelName]
			model?[eventName]?(data)
			
	addModel: (model, name) ->
		#guard against further exceptions if model isn't a Skull.Model/Collection
		if not Skull.isValidModel(model) then throw 'Skull.Model or Skull.Collection expected!'
		
		if model instanceof Skull.Collection then Helper = CollectionHelper else Helper = ModelHelper 
		
		name ?= model.name()
		model._skull = this
		model.sync = @sync
		@models[name] = new Helper model, name
		model
	
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
			
if exports
	exports.Model = Skull.Model
	exports.Collection = Skull.Collection
	exports.createClient = Skull.createClient
	
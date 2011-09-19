window?.module?.enter 'skull'

Backbone.assert = (what) ->	
	if not what 
		console.log "Assertion failed!"
		debugger

Config = {}
Config.debug = true
exports.Config = Config
	
log = (msg) ->
	console.log msg if Config.debug
		
class LockableModel extends Backbone.Model
	constructor: () ->
		@locked = false
		@lockedBy = {}
		@editing = false
		super
	#???
	initShared: ->
		@bind 'remove', => @view.remove() if @view

	isLocked: -> @locked
	isEditing: -> @editing 
	
	#lockinfo received from the server after performing a 'read' request
	#This is the initial lock state of the model
	setLockInfo: (lockinfo) ->
		log 'set lock info'
		if @id and lockinfo[@id]
			if lockinfo[@id].__sid == @__sid
				log 'Model locked by me'
				@locked = false
				@lockedBy = @__sid
				@editing = true
				@trigger 'locked', @, @lockedBy
			else
				log 'Model locked by ' + lockinfo[@id].__sid
				@editing = false
				@serverLock lockinfo[@id].__sid
		else
			log 'ignoring lock info - no @id or lockinfo[@id]'
		
	#received 'lock' info from server 
	#another user (who) has locked this model
	serverLock: (who) ->
		
		#are we holding the lock ?
		if @editing && who == @__sid 
			@lockedBy = @__sid
			return @trigger 'locked', @, @lockedBy
		
		#someone else locked the model.
		#mark it as locked and emit the event
		@locked = true
		@lockedBy = who
		@trigger 'locked', @, @lockedBy

	#the model has been unlocked and can now be edited
	serverUnlock: () ->
		@locked = false
		@lockedBy = ""
		@trigger 'unlocked', @, @lockedBy
	
	#notify server that we want to edit this model
	#When server replies, callback is called and the first parameter contains the error code (null if success)
	lock: (callback) -> 
		return callback(null, @lockedBy) if @editing
		return callback('error', @lockedBy) if @locked
		
		Backbone.assert @locked is false && @editing is false
		@trigger 'lock', @, (err, lockinfo) =>
			console.log 'Lock result = ' + err
			@editing = true if err is null
			callback err, lockinfo

	#notify server that we've finished editing it
	unlock: (callback) ->
		if @editing
			@editing = false
			@trigger 'unlock', @, callback
		
class Model extends LockableModel

	constructor: (options) ->
		url = options?.url || @url
		if options then delete options.url
		
		if url and typeof url == 'string'
			@socket = io.connect url
			@socket.on 'disconnect', => @trigger 'disconnected'
			@socket.on 'connect', =>
				@__sid = @socket.socket.sessionid
				log 'connected --> ' + @__sid
					
			#create ???
			@socket.on 'update', (data) =>	@set data
			@socket.on 'delete', => @destroy()
		
			@socket.on 'lock', (lockinfo) =>
				@serverLock lockinfo.__sid 
			
			@socket.on 'unlock', (lockinfo) =>
				@serverUnlock lockinfo.__sid 
		
			@socket.on 'rejected', (modinfo) =>
				@unset 'moderating'
				@trigger 'rejected', modinfo
		
			@bind 'lock', (model, callback) =>
				log 'model lock ' + @id
				if @id
					@socket.emit 'lock', {id: @id}, (err, lockinfo) ->
						log 'Called back: ' + err
						callback err, lockinfo
				else
					callback? null

			@bind 'unlock', (model, callback) =>
				log 'model unlock ' + @id
				@socket.emit 'unlock', {id: model.id} if model.id
				
		super
		
	emitCommand: (name, args, callback)->
		socket = @socket || @collection?.socket
		return callback?('model is not connected') unless socket
		socket.emit 'command', name, args, callback 
		
	sync: (method, model, cbo) ->
		#forward create methods to the collection
		#Models cannot really create themselves
		if method == 'create' || not @socket
			return @collection.sync method, @, cbo 
		
		log 'Model.sync = ' + method + ': id = ' + @id
		@socket.emit method,  @toJSON(), (error, data, lockinfo) =>
			log 'Model sync result: ' + error
			if error == null
				cbo.success data
				@setLockInfo lockinfo, @socket.socket.sessionid if method is 'read' 
			else
				cbo.error()
				if status is 'moderating' then @trigger 'moderating', @, data
				
class Collection extends Backbone.Collection
	
	constructor: (models, options) ->
		
		url = options.url || @url
		delete options.url
		
		@socket = io.connect url

		@socket.on 'disconnect', => 
			log 'disconnected from server'
			@trigger 'disconnected'
		
		@socket.on 'create', (data) =>
			log 'collection.add'
			#check for temporary id
			id = data.__id || data.id
			if id
				#if present, update with the real id
				log 'add -> already exists -> updating '
				model = @get id
				delete data.__id
				return model.set data if model
			
			@add data
			
		@socket.on 'update', (data) =>
			id = data.id
			log 'collection.update, id: ' + id

			model = @get id if id
			model.set data if model
		
		@socket.on 'delete', (data) =>
			log 'collection.remove, id: ' + data.id
			model = @get data.id if data.id
			@remove model if model

		#server notifies that a model in this collection is locked
		@socket.on 'lock', (locks, user) =>
			if locks.__sid == @socket.socket.sessionid
				return 
			
			if !_.isArray(locks) then locks = [locks]
		
			_.each locks, (lockinfo) =>
				id = lockinfo?.id
				return false unless id
				log 'Lock request for ' + id
				model = @get id 
				model.serverLock(user) if model
		
		#server notifies that a model in this collection was unlocked
		@socket.on 'unlock', (locks) =>
		
			if locks.__sid == @socket.socket.sessionid
				return
		
			if !_.isArray(locks) then locks = [locks]
		
			_.each locks, (lockinfo) =>
				id = lockinfo?.id
				return false unless id
				log 'Unlock request for ' + id
				model = @get id if id
				model.serverUnlock() if model
		
		#moderation rejected
		@socket.on 'rejected', (modinfo) =>
			log 'rejected: ' + modinfo.id
			id = modinfo.id
			model = @get id if id
			model.unset 'moderating'
			model.trigger 'rejected', model, modinfo
			
		@bind 'lock', (model, callback) =>
			return false unless model
			log 'Collection lock: ' + model.id
			if model.id
				@socket.emit 'lock', {id: model.id}, callback
			else
				callback? null
				
		@bind 'unlock', (model) =>
			log 'Collection unlock: ' + model.id
			@socket.emit 'unlock', {id: model.id} if model.id
			
		super 
	
	sync: (method, model, cbo) =>
		json = model.toJSON()
		
		log 'Sync: method= ' + method + ' : model id = ' + model.id
		
		
		@socket.emit method, json, (status, data) ->
			
			log 'Sync result: status=' + status + '; data.__id = ' + data?.__id
			
			if status is null or (status is 'moderating' and method is 'create')
				
				data.id ?= data.__id if data
				
				cbo.success data
			else
				#cancel the requested method
				cbo.error model
				#but update the status if reply is 'moderating'
				if status is 'moderating'
					model.trigger 'moderating', model, data
					
BackboneSync = Backbone.sync

Backbone.sync = (method, model, cbo) ->
	sync = model.sync || model.collection?.sync || BackboneSync
	sync?(method, model, cbo)
			
				
exports.LockableModel = LockableModel
exports.Model = Model
exports.Collection = Collection

EventEmitter = require('events').EventEmitter
_ = require 'underscore'
io = require 'socket.io'
util = require 'util'
path = require 'path'
g_Debug = true
g_Io = null

exports.enableLogging = (yesorno) -> g_Debug = yesorno
log = -> console.log.apply console, arguments if g_Debug

exports.listen = (io) ->
	g_Io = io
	dir = path.dirname module.filename
	#TODO: Try to serve file without depending on express routes
	#Tip: Plug it into socket.io somehow
	io.server?.routes?.app.get '/skull.io/skull.io.js', (req, res) ->
		res.sendfile path.join dir, 'clientSkull.js'
	
	#_.extend io.Manager.static.paths, "/skull.io" : path.join dir, './clientSkull.js'

class LockableModel extends EventEmitter
	
	constructor: ->
		log 'Lockable constructor'
		@_locks = {}
		@setMaxListeners 0
		super 
		
	lock: (lockinfo, callback) ->
		curlock = @_locks[lockinfo.id]
		
		log 'Lock request from ' + lockinfo.__sid
		
		return callback? "failed", lockinfo if curlock and curlock.__sid isnt lockinfo.__sid
		
		@_locks[lockinfo.id] = lockinfo
		
		callback? callback null, lockinfo
		
		@emit "lock", lockinfo
		return true
		
	unlock: (lockinfo, callback) ->
		curlock = @_locks[lockinfo.id]
		if curlock
			log 'Unlock ' + lockinfo.id + ' by ' + lockinfo.__sid
			delete @_locks[lockinfo.id]
			callback? callback null, lockinfo if callback
			@emit "unlock", lockinfo
			return true
			
		return callback? "failed", lockinfo
	
	#must be called when the socket is disconnected
	removeUserLocks: (sid) ->
		log "Removing #{sid} from these: #{util.inspect @_locks}"
		_.each @_locks, (lock) =>
			@unlock lock if lock.__sid == sid
		
	
		
class Model extends LockableModel
	constructor: -> super
		
	read: (filter, callback) -> callback null, {}
	create: (data, callback) -> cabllack null, data
	update: (data, callback) -> callback null, data
	delete: (data, callback) -> callback null, data

class View
	constructor: (@name, @model) ->
	
		log 'Skull View: Creating view ' + @name
		@widget = g_Io.of @name
		@widget.on 'connection', @connection

	#stop listening for connections from the socket
	unbind: ->
		log 'Unbinding view ' + @name
		@widget.removeListener 'connection', @connection
		
	connection: (socket) =>
			
			log 'New connection to ' + @name + ' from socket ' + socket.id
			#call it if it's a function
			model = @model?(socket, @name) ? @model
			
			if not model
				log 'Model lookup failed. Bailing out.'
				socket.emit 'error', 'Cannot access dynamic model ' + @name + '. Model lookup failed'
				return 
			
			@authorize socket, =>				
				socket.on 'disconnect', => 
					log 'socket disconnected: ' + socket.id
					model.removeUserLocks socket.id
					
				socket.on 'read', (data, callback) => 
					model.read? data, (result, data) => 
						callback? result, data, model._locks
						
				@fuseEvents socket, model, ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast']
				
				#clients can emit commands, these are forwarded to the model
				socket.on 'command', (name, data, callback = ->)->
					log 'Client command: ' + name
					cb = model['client_' + name]
					return callback?("command not supported") unless cb
					cb(data, callback, socket) 
				
				model.on 'error', (message, data) -> socket.emit 'error', message, data
				
			, (errorMsg) -> socket.emit 'error', errorMsg
			
			
	#forward the events in list of events (loEvents) 
	#from model to the socket and vice-versa	
	fuseEvents: (socket, model, loEvents) ->
		log 'Fusing events for model ' + model.name + ' to socket ' + socket.id
		model.setMaxListeners 0
		socket.setMaxListeners 0
		
		_.each loEvents, (ev) ->
			
			#ignore events not handled by the model
			if not model[ev] then return
			
			moHandler = (data) ->
				log 'From Model -> to Socket: ' + socket.id + ' : ' + ev + ': ' + util.inspect arguments[0]
				socket.emit.call socket, ev, data

			model.on ev, moHandler
				
			socket.on 'disconnect', -> 
				log '** Model ' + model.name + ' !--!  ' + socket.id
				model.removeListener ev, moHandler
				
			socket.on ev, ->
				log 'From Socket ' + socket.id + ' to model : ' + model.name + ' : ' + ev + ': ' + util.inspect arguments[0]
				[data, callback] = arguments
				
				callback ?= ->
					
				extra = 
					socket: socket

				data.__sid = socket.id if typeof data is 'object'
				model[ev]?.call model, data, callback, extra
				
	authorize: (socket, success, error) -> success()
		
exports.Model = Model
exports.View = View
	

	
	
	
	
	
	
	

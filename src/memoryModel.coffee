_ = require 'underscore'
#Simple memory model. Good for quickly prototyping models.
module.exports = class MemoryModel extends require('./serverSkull').Model
	constructor: ->
		@items = {}
		@id = 9938
		super()
		
	read: (filter, callback) ->
		callback? null, _.toArray @items
	create: (items, callback) ->
		
		if _.isArray items then list = items else list = [items]
		
		_.each list, (data) =>
			id = data.id || @id++
			data.id = id
			@items[id] = data
		callback? null, items
		@emit "create", items
		
	update: (data, callback) ->
		#TODO: Work on arrays ?
		if @items[data.id]
		
			_.each data, (value, key) =>
				@items[data.id][key] = value
				
			callback? null, data
			@emit "update",  data
		else
			callback? "error", data
			
	delete: (data, callback) ->
		#TODO: Work on arrays ?
		if @items[data.id]
			delete @items[data.id]
			callback? null, data
			@emit "delete", data
		else
			callback? "error", data
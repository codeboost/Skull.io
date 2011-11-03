(function() {
  var ModuleLoader;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  ModuleLoader = (function() {
    function ModuleLoader() {
      this.require = __bind(this.require, this);
      this.create = __bind(this.create, this);
    }
    ModuleLoader.prototype.modules = {};
    ModuleLoader.prototype.create = function(name) {
      if (!this.modules[name]) {
        this.modules[name] = {};
      }
      return this.modules[name];
    };
    ModuleLoader.prototype.require = function(name) {
      if (!this.modules[name]) {
        throw 'Module "' + name + '" not found';
      }
      return this.modules[name];
    };
    ModuleLoader.prototype.enter = function(name) {
      window.exports = this.create(name);
      return window.require = this.require;
    };
    return ModuleLoader;
  })();
  window.module = new ModuleLoader;
}).call(this);

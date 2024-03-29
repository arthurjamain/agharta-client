/*

  A list.

  Binds to a collection. Every item has its own view, which is created by the
  itemFactory options.

  Will also add a loading class to the DOM element when the collection is syncing.

  TODO: List should derivate from Layout

*/

define(["lib/joshlib/View","lib/joshlib/Item","lib/joshlib/ListItem","underscore", "jquery"], function(UIElement, UIItem, UIListItem, _, $) {

  var UIList = UIElement.extend({
    initialize:function(options) {
      if (options.templateEl) {
        this.template = this.compileTemplate($(options.templateEl).text());
      } else if (options.template) {
        this.template = this.compileTemplate(options.template);
      } else {
        this.template = this.compileTemplate('<ul><%= children %></ul>');
      }

      this.UIItemClass = options.UIItemClass || UIItem;
      this.itemOptions = options.itemOptions || {scroller: false};
      this.itemTemplateEl = options.itemTemplateEl;
      this.itemOptions.templateEl = this.itemOptions.templateEl || this.itemTemplateEl;
      this.itemOptions.template = this.itemOptions.template || options.itemTemplate;
      this.contentSelector = options.contentSelector;
      this.items = [];

      // Default item factory
      this.itemFactory = options.itemFactory || function(model, offset) {
        var params = {
          model: model,
          offset: offset
        };

        _.extend(params, this.itemOptions);
        return new UIItem(params);
      };

      // The list must wait for all of its children to be "loaded"
      // before it may trigger the "load" event.
      this.customLoadEvent = true;

      // Data loading class that gets added to the view's element
      // while data synchro is on. "loading" is used if not overridden
      // Set the option to false or null (and not undefined) to cancel
      // the addition of the class.
      this.dataLoadingClass = 'loading';
      if (typeof options.dataLoadingClass !== 'undefined') {
        this.dataLoadingClass = options.dataLoadingClass;
      }
      if (this.dataLoadingClass === false) {
        this.dataLoadingClass = null;
      }

      // Propagate "shown", "hidden" events to the view's children
      this.bind('shown', function () {
        _.each(this.items, function (child) {
          child.trigger('shown');
        });
      }, this);
      this.bind('hidden', function () {
        _.each(this.items, function (child) {
          child.trigger('hidden');
        });
      }, this);

      UIElement.prototype.initialize.call(this, options);

      if (options.collection) this.setCollection(options.collection);
    },

    setCollection: function(collection, render) {
      if(this.collection) {
        this.collection.unbind('change', this.update, this);
        this.collection.unbind('add', this.update, this);
        this.collection.unbind('remove', this.update, this);
        this.collection.unbind('reset', this.update, this);
        this.collection.unbind('syncstarted', this.syncStartedHandler, this);
        this.collection.unbind('syncsuccess', this.syncSuccessHandler, this);
        this.collection.unbind('syncerror', this.syncErrorHandler, this);
      }

      this.collection = collection;

      if(collection) {
        collection.bind('change', this.update, this);
        collection.bind('add', this.update, this);
        collection.bind('remove', this.update, this);
        collection.bind('reset', this.update, this);
        collection.bind('syncstarted', this.syncStartedHandler, this);
        collection.bind('syncsuccess', this.syncSuccessHandler, this);
        collection.bind('syncerror', this.syncErrorHandler, this);
      }

      this.update(render);
    },

    update: function(render) {
      // TODO: destroy previous items?

      this.items = new Array(this.collection.length);
      this.itemsLoaded = 0;

      var itemLoaded = function () {
        ++this.itemsLoaded;
        if (this.itemsLoaded === this.items.length) {
          // All children have been loaded
          this.trigger('load');
        }
      };

      // Create item elements
      for (var i = 0; i < this.collection.length; i++) {
        var model = this.collection.at(i);
        this.items[i] = new UIListItem({
          view: this.itemFactory.call(this, model, i),
          model:  model,
          offset: i
        });

        // React to the "load" event of the child view,
        // triggering the "load" event of the container once
        // all children have been loaded.
        this.items[i].bind('load', _.bind(itemLoaded, this));
      }

      if(render) this.render();
    },

    generate: function(cb) {
      var items = this.items;
      var contents = new Array(items.length);
      var processed = 0;
      var template = this.template;

      if(!items.length) {
        var str = template({children: ''});
        cb(null, str);
        return;
      }

      for (var i = 0; i < items.length; i++) {
        // Create a scope for the current item
        (function(item, num) {
          this.generateItem(function(err, content) {
            contents[num] = content;

            // If last item was processed, fire callback
            if(++processed === items.length) {
              var str = template({children: contents.join('')});
              cb(null, str);
            }
          }, item);
        }).call(this, items[i], i);
      }
    },

    generateItem: function(cb, item) {
      item.generate(cb);
    },

    enhance: function() {
      var $lis = this.$('li');

      for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        item.setElement($lis[i]);
        item.enhance();
      }

      this.$('.joshfire-link').unbind('click').bind('click', function(e) {
        e.preventDefault();
        var location = $(e.currentTarget).attr('data-joshfire-link-url');
        window.location = location;
        return false;
      });

      UIElement.prototype.enhance.call(this);

      if (this.items.length === 0) {
        // No children to render? That means the list is loaded
        this.trigger('load');
      }
    },

    setContent: function(html) {
      if(this.contentSelector) {
        this.$(this.contentSelector).html(html);
      } else {
        $(this.el).html(html);
      }
    },

    syncStartedHandler: function() {
      if (this.dataLoadingClass) $(this.el).addClass(this.dataLoadingClass);
    },

    syncSuccessHandler: function() {
      var self = this;
      if (this.dataLoadingClass) window.setTimeout(function () {
        $(self.el).removeClass(self.dataLoadingClass);
      }, 5000);
    },

    syncErrorHandler: function() {
      if (this.dataLoadingClass) $(this.el).removeClass(this.dataLoadingClass);
    }
  });

  return UIList;
});
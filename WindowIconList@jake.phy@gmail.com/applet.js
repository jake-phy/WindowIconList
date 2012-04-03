//version: 1.5
const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Panel = imports.ui.panel;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Tooltips = imports.ui.tooltips;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;

const AppletDir = imports.ui.appletManager.applets['WindowIconList@jake.phy@gmail.com'];
const ThumbnailPreview = AppletDir.thumbnailPreview;
const RightClickMenu = AppletDir.rightClickMenu;

// size of the icons
const PANEL_ICON_SIZE = 24;
const SPINNER_ANIMATION_TIME = 1;

const OPTIONS = {
		    // THUMBNAIL OPTIONS are in thumbnailPreview.js

		    SHOW_TITLE: false,

                    // GROUP_BY_APP
                    //     true: only one button is shown for each application (all windows are grouped)
                    //     false: every window has its own button
                    //GROUP_BY_APP: true,

		    // SHOW_PINNED_APPS
                    //     true: show the favorites
                    //     false: hide the favorites
		    SHOW_PINNED_APPS: true
                };

function FavoritesLauncher(applet, app, orientation) {
    this._init(applet, app, orientation);
}

FavoritesLauncher.prototype = {
    _init: function(applet, app, orientation) {
        this._applet = applet;
	this.app = app;
        this.actor = new St.Bin({ style_class: 'panel-launcher',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        this.icon = this.app.create_icon_texture(PANEL_ICON_SIZE);
        this._container = new Cinnamon.GenericContainer();
        this.actor.set_child(this._container);
	this._container.add_actor(this.icon);

        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));	

        /*this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();*/
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new RightClickMenu.FavoritesRightClickMenu(this.actor, this.app, orientation);
        this._menuManager.addMenu(this._menu);
        
        let tooltipText = app.get_name();
        if ( app.get_description() ) {
            tooltipText += '\n' + app.get_description();
        }
        this._tooltip = new Tooltips.PanelItemTooltip(this, tooltipText, orientation);
        
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        
        this.on_panel_edit_mode_changed();
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    },
    
    on_panel_edit_mode_changed: function() {
        this._draggable.inhibit = global.settings.get_boolean("panel-edit-mode");
    }, 
        
    _onDragBegin: function() {
        this._tooltip.hide();
        this._tooltip.preventShow = true;
    },

    _onDragEnd: function() {
        this._applet.myactorbox._clearDragPlaceholder();
        this._tooltip.preventShow = false;
    },

    _onDragCancelled: function() {
        this._applet.myactorbox._clearDragPlaceholder();
        this._tooltip.preventShow = false;
    },

    _onButtonRelease: function(actor, event) {
	    let button = event.get_button();
            if (button==1) {
		        if (this._menu.isOpen) this._menu.toggle();
			this.app.open_new_window(-1);
			this.animationStart();
            }else if (button==3) {
		        this._menu.toggle();
            }
    },
    
    handleDragOver: function(source, actor, x, y, time) {
        if (source instanceof FavoritesLauncher) return DND.DragMotionResult.CONTINUE;
        
        if (typeof(this._applet.dragEnterTime) == 'undefined') {
            this._applet.dragEnterTime = time;
        } else {
            if (time > (this._applet.dragEnterTime + 3000))
            {
                this._applet.dragEnterTime = time;
            }
        }
    },
    
    acceptDrop: function(source, actor, x, y, time) {
        return false;
    },

    animationStart: function() {
	this.icon.set_z_rotation_from_gravity(0.0, Clutter.Gravity.CENTER)
        Tweener.addTween(this.icon,
                         { opacity: 70,
			   time: 1.0,
                           transition: "linear",
                           onCompleteScope: this,
                           onComplete: function() {
       	 			Tweener.addTween(this.icon,
                	        		 { opacity: 255,
						   time: 0.5,
                	        		   transition: "linear"
                	        		 });
                           }
                         });
    },
    animationStop: function() {
    },

    _getContentPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this.icon.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
    },

    _getContentPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this.icon.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
    },

    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this.icon.get_preferred_size();

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 0;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this.icon.allocate(childBox, flags);

        let iconWidth = PANEL_ICON_SIZE;

        /*if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth / 2);
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        } else {
            childBox.x1 = -this._spinner.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        }*/
    },

    getDragActor: function() {
        return new Clutter.Clone({ source: this.actor });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};

function AppMenuButton(applet, metaWindow, animation, orientation) {
    this._init(applet, metaWindow, animation, orientation);
}

AppMenuButton.prototype = {
//    __proto__ : AppMenuButton.prototype,

    
    _init: function(applet, metaWindow, animation, orientation) {
               
        this.actor = new St.Bin({ style_class: 'window-list-item-box',
								  reactive: true,
								  can_focus: true,
								  x_fill: true,
								  y_fill: false,
								  track_hover: true });
								  
	if (orientation == St.Side.TOP) 
		this.actor.add_style_class_name('window-list-item-box-top');
	else
		this.actor.add_style_class_name('window-list-item-box-bottom');
      
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

		this.metaWindow = metaWindow;	
        
        this._applet = applet;	
		
        let bin = new St.Bin({ name: 'appMenu' });
        this.actor.set_child(bin);

        this._container = new Cinnamon.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        
        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new St.Label();
        this._container.add_actor(this._label);

        this._iconBottomClip = 0;

        this._visible = !Main.overview.visible;
        if (!this._visible)
            this.actor.hide();
        Main.overview.connect('hiding', Lang.bind(this, function () {
            this.show();
        }));
        Main.overview.connect('showing', Lang.bind(this, function () {
            this.hide();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        
        this._updateCaptionId = this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            let title = this.getDisplayTitle();
	    if (!OPTIONS['SHOW_TITLE']){
        	this._label.set_text('');
	    }else{
		this._label.set_text(title);
	    }
            //if (this._tooltip) this._tooltip.set_text(title);
        }));
                
        this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();

		let tracker = Cinnamon.WindowTracker.get_default();
		this.app = tracker.get_window_app(this.metaWindow);
		let icon = this.app.create_icon_texture(PANEL_ICON_SIZE);
        let title = this.getDisplayTitle();
        if (metaWindow.minimized)
            this._label.set_text("[" + title + "]");
        else
            this._label.set_text(title);	
        this._iconBox.set_child(icon);
        
        if(animation){
			this.startAnimation(); 
			this.stopAnimation();
		}
		
        //set up the right click menu
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this.rightClickMenu = new RightClickMenu.AppMenuButtonRightClickMenu(this.actor, this.metaWindow, orientation);
        this._menuManager.addMenu(this.rightClickMenu);

       // Set up the hover menu
        this._hoverMenuManager = new ThumbnailPreview.HoverMenuController(this);
        this.hoverMenu = new ThumbnailPreview.AppThumbnailHoverMenu(this.actor, this.metaWindow, orientation);
        this._hoverMenuManager.addMenu(this.hoverMenu);
        
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        
        this.on_panel_edit_mode_changed();
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    },
    
    on_panel_edit_mode_changed: function() {
        this._draggable.inhibit = global.settings.get_boolean("panel-edit-mode");
    }, 
        
    _onDragBegin: function() {
        this.hoverMenu.close(true);
    },

    _onDragEnd: function() {
        this._applet.myactorbox._clearDragPlaceholder();
    },

    _onDragCancelled: function() {
        this._applet.myactorbox._clearDragPlaceholder();
    },

    getDisplayTitle: function() {
        let title = this.metaWindow.get_title();
        if (!title) title = this.app.get_name();
        return title;
    },

    _onDestroy: function() {
        this.metaWindow.disconnect(this._updateCaptionId);
    },
    
    doFocus: function() {
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);
        if ( app ) {  
            let icon = app.create_icon_texture(PANEL_ICON_SIZE);
    		this._iconBox.set_child(icon);	
        }         
        if (this.metaWindow.has_focus()) {                                     
        	this.actor.add_style_pseudo_class('focus');    
            this.actor.remove_style_class_name("window-list-item-demands-attention");    	
            this.actor.remove_style_class_name("window-list-item-demands-attention-top");
        }        		    	        
        else {            
          	this.actor.remove_style_pseudo_class('focus');        		
        }	    	                
    },
    
    _onButtonRelease: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            if ( this.rightClickMenu.isOpen ) {
                this.rightClickMenu.toggle();
            }
            this._windowHandle(true);
        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK) {
            this.metaWindow.delete(global.get_current_time());
            this.rightClickMenu.destroy();
            this.hoverMenu.destroy();
        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();
        }   
    },

    _windowHandle: function(fromDrag) {
      if (this.metaWindow.minimized) {
        this.metaWindow.unminimize(global.get_current_time());
        this.metaWindow.activate(global.get_current_time());
        this.actor.add_style_pseudo_class('focus');
      }else if (this.metaWindow.has_focus()) {
            if (!fromDrag) {
               this.metaWindow.minimize(global.get_current_time());
     	       this.actor.remove_style_pseudo_class('focus');
            }else {
            this.metaWindow.activate(global.get_current_time());
            this.actor.add_style_pseudo_class('focus');    
            
          }
      }else {
 	    this.metaWindow.activate(global.get_current_time());
            this.actor.add_style_pseudo_class('focus'); 
      }
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (source instanceof AppMenuButton ) return DND.DragMotionResult.CONTINUE;
        
        if (typeof(this._applet.dragEnterTime) == 'undefined') {
            this._applet.dragEnterTime = time;
        } else {
            if (time > (this._applet.dragEnterTime + 3000))
            {
                this._applet.dragEnterTime = time;
            }
        }
                
        if (time > (this._applet.dragEnterTime + 300)) {
            this._windowHandle(true);
        }
    },
    
    acceptDrop: function(source, actor, x, y, time) {
        return false;
    },
    
    show: function() {
        if (this._visible)
            return;
        this._visible = true;
        this.actor.show();
    },

    hide: function() {
        if (!this._visible)
            return;
        this._visible = false;
        this.actor.hide();
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('app-icon-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
       if (this._iconBottomClip > 0)
           this._iconBox.set_clip(0, 0,
                                 allocation.x2 - allocation.x1,
                                   allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },

    stopAnimation: function() {
        Tweener.addTween(this._spinner.actor,
                         { opacity: 0,
                           time: SPINNER_ANIMATION_TIME,
                           transition: "easeOutQuad",
                           onCompleteScope: this,
                           onComplete: function() {
                               this._spinner.actor.opacity = 255;
                               this._spinner.actor.hide();
                           }
                         });
    },

    startAnimation: function() {
        this._spinner.actor.show();
    },

    _getContentPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_width(forHeight);
//        alloc.min_size = alloc.min_size + Math.max(0, minSize - Math.floor(alloc.min_size / 2));
        alloc.min_size = alloc.min_size + Math.max(0, minSize);
//        alloc.natural_size = alloc.natural_size + Math.max(0, naturalSize - Math.floor(alloc.natural_size / 2));
	if (!OPTIONS['SHOW_TITLE'])
		alloc.natural_size = PANEL_ICON_SIZE +6;
	else
        	alloc.natural_size = 150; // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
    },

    _getContentPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_height(forWidth);
        if (minSize > alloc.min_size)
            alloc.min_size = minSize;
        if (naturalSize > alloc.natural_size)
            alloc.natural_size = naturalSize;
    },

    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 3;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = PANEL_ICON_SIZE;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + 5);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth + 3);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth / 2) + this._label.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        } else {
            childBox.x1 = -this._spinner.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        }
    },
    
    getDragActor: function() {
        return new Clutter.Clone({ source: this.actor });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};

function MyAppletBox(applet) {
    this._init(applet);
}

MyAppletBox.prototype = {
    _init: function(applet) {
        this.actor = new St.BoxLayout({ name: 'windowList',
                                       	style_class: 'window-list-box' });
        this.actor._delegate = this;
        
        this._applet = applet;
        
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },
    
    handleDragOver: function(source, actor, x, y, time) {
        if (!(source.isDraggableApp || (source instanceof FavoritesLauncher || AppMenuButton)))return DND.DragMotionResult.NO_DROP;
        
        let children = this.actor.get_children();
        let windowPos = children.indexOf(source.actor);
        
        let pos = 0;
        
        for (var i in children){
            if (x > children[i].get_allocation_box().x1 + children[i].width / 2) pos = i;
        }
        
        if (pos != this._dragPlaceholderPos) {            
            this._dragPlaceholderPos = pos;

            // Don't allow positioning before or after self
            if (windowPos != -1 && pos == windowPos) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                        Lang.bind(this, function() {
                            this._animatingPlaceholdersCount--;
                        }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }
	    let placeWidth;
	    let placeHeight;  
	    if (source.isDraggableApp) {
	        placeWidth = (30);
	        placeHeight = (24);
	    }else {
	        placeWidth = (source.actor.width);
	        placeHeight = (source.actor.height);
	    }
            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (placeWidth);
            this._dragPlaceholder.child.set_height (placeHeight);
            this.actor.insert_actor(this._dragPlaceholder.actor,
                                        this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }
        
        return DND.DragMotionResult.MOVE_DROP;
    },
    
    acceptDrop: function(source, actor, x, y, time) {  
        if (!(source.isDraggableApp || (source instanceof AppMenuButton || FavoritesLauncher))) return false;
	if (source instanceof AppMenuButton) {
        this.actor.move_child(source.actor, this._dragPlaceholderPos);
       
        this._clearDragPlaceholder();
        actor.destroy();
	return true;

	}else if (source.isDraggableApp || (source instanceof FavoritesLauncher)) {

        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed()) {
            return false;
        }

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;
            
            if (!(source.isDraggableApp || (children[i]._delegate instanceof FavoritesLauncher))) continue;

            let childId = children[i]._delegate.app.get_id();
            if (childId == id)
                continue;
            if (childId in favorites)
                favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function () {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            }));
        this._clearDragPlaceholder();
        actor.destroy
        return true;
	}else
	return false;
    },
    
    _clearDragPlaceholder: function() {        
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);
        
        try {                    
            this.orientation = orientation;
            this.dragInProgress = false;
            
            this.myactorbox = new MyAppletBox(this);
            this.myactor = this.myactorbox.actor;
        
            this.actor.add(this.myactor);
            this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
                                       	
            if (orientation == St.Side.TOP) {
                this.myactor.add_style_class_name('window-list-box-top');
                this.myactor.set_style('margin-top: 0px;');
                this.myactor.set_style('padding-top: 0px;');
                this.actor.set_style('margin-top: 0px;');
                this.actor.set_style('padding-top: 0px;');
            }
            else {
                this.myactor.add_style_class_name('window-list-box-bottom');
                this.myactor.set_style('margin-bottom: 0px;');
                this.myactor.set_style('padding-bottom: 0px;');
                this.actor.set_style('margin-bottom: 0px;');
                this.actor.set_style('padding-bottom: 0px;');
            }
                                                
        
            this._windows = new Array();
	    this._favDisplay();

            Cinnamon.AppSystem.get_default().connect('installed-changed', Lang.bind(this, this._refreshItems));
            AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshItems));
                
            let tracker = Cinnamon.WindowTracker.get_default();
            tracker.connect('notify::focus-app', Lang.bind(this, this._onFocus));


            this.switchWorkspaceHandler = global.window_manager.connect('switch-workspace',
                                            Lang.bind(this, this._refreshItems));
            global.window_manager.connect('minimize',
                                            Lang.bind(this, this._onMinimize));
            global.window_manager.connect('maximize',
                                            Lang.bind(this, this._onMaximize));
            global.window_manager.connect('unmaximize',
                                            Lang.bind(this, this._onMaximize));
            global.window_manager.connect('map',
                                            Lang.bind(this, this._onMap));
                                            
            Main.expo.connect('showing', Lang.bind(this, 
	    					function(){	global.window_manager.disconnect(this.switchWorkspaceHandler);}));
	    Main.expo.connect('hidden', Lang.bind(this, 
						function(){	this.switchWorkspaceHandler=global.window_manager.connect('switch-workspace', 
												Lang.bind(this, this._refreshItems)); 
								this._refreshItems();}));

	    Main.overview.connect('showing', Lang.bind(this, 
						function(){	global.window_manager.disconnect(this.switchWorkspaceHandler);}));
	    Main.overview.connect('hidden', Lang.bind(this, 
						function(){	this.switchWorkspaceHandler=global.window_manager.connect('switch-workspace', 
												Lang.bind(this, this._refreshItems)); 
								this._refreshItems();}));
            
            this._workspaces = [];
            this._changeWorkspaces();
            global.screen.connect('notify::n-workspaces',
                                    Lang.bind(this, this._changeWorkspaces));
            global.display.connect('window-demands-attention', Lang.bind(this, this._onWindowDemandsAttention));
                                    
            // this._container.connect('allocate', Lang.bind(Main.panel, this._allocateBoxes)); 
            
            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));                                                                               
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
            
    },        
    
    on_panel_edit_mode_changed: function() {
        this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
    }, 
    
           
    _onWindowDemandsAttention : function(display, window) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == window ) {                
                this._windows[i].actor.add_style_class_name("window-list-item-demands-attention");                
            }
        }
    },

    _onFocus: function() {
        for ( let i = 0; i < this._windows.length; ++i ) {
            this._windows[i].doFocus();
        }
    },

    /*_redisplay: function() {
        for ( let i=0; i<this._buttons.length; ++i ) {
            this._buttons[i].actor.destroy();
        }

        this._refreshItems();
    },*/

    _favDisplay: function() {
	if (OPTIONS['SHOW_PINNED_APPS']) {
            let launchers = global.settings.get_strv('favorite-apps'),
            appSys = Cinnamon.AppSystem.get_default(),
	    i = 0,
	    launcher;
	    this._buttons = [];
	    while(i < launchers.length) {
                launcher = appSys.lookup_app(launchers[i]);
                if (!launcher) launcher = appSys.lookup_settings_app(launchers[i]);
            	    this.favButton = new FavoritesLauncher(this, launcher, this.orientation);
            	    this.myactor.add(this.favButton.actor);
		    i++;
	    }
	}else 
	return;
    }, 
    
    _refreshItems: function() {
        this.myactor.destroy_children();
	this._favDisplay(); 
        this._windows = new Array();

        let metaWorkspace = global.screen.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        windows.sort(function(w1, w2) {
            return w1.get_stable_sequence() - w2.get_stable_sequence();
        });
                
        // Create list items for each window
        let tracker = Cinnamon.WindowTracker.get_default();
        for ( let i = 0; i < windows.length; ++i ) {
            let metaWindow = windows[i];
            if ( metaWindow && tracker.is_window_interesting(metaWindow) ) {
                let app = tracker.get_window_app(metaWindow);
                if ( app ) {
                    let appbutton = new AppMenuButton(this, metaWindow, false, this.orientation);
                    this._windows.push(appbutton);
                    this.myactor.add(appbutton.actor);
                }

            }
        }

        this._onFocus();
    },

    _onWindowStateChange: function(state, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {
                let windowReference = this._windows[i];
                let menuReference = this._windows[i].rightClickMenu;
                let title;
		if (OPTIONS['SHOW_TITLE'])	
			title = windowReference.getDisplayTitle();
		else	
			title = '';
                
                if (state == 'minimize') {
			windowReference._label.set_text("["+ title +"]");
                    menuReference.itemMinimizeWindow.label.set_text(_("Restore"));
                    
                    return;
                } else if (state == 'map') {
			windowReference._label.set_text(title);
                    menuReference.itemMinimizeWindow.label.set_text(_("Minimize"));
                    
                    return;
                }
            }
        }
    },
    
    _onMinimize: function(cinnamonwm, actor) {
        this._onWindowStateChange('minimize', actor);
    },
    
    _onMaximize: function(cinnamonwm, actor) {
        this._onWindowStateChange('maximize', actor);
    },
    
    _onMap: function(cinnamonwm, actor) {
    	/* Note by Clem: The call to this._refreshItems() below doesn't look necessary. 
    	 * When a window is mapped in a quick succession of times (for instance if 
    	 * the user repeatedly minimize/unminimize the window by clicking on the window list, 
    	 * or more often when the showDesktop button maps a lot of minimized windows in a quick succession.. 
    	 * when this happens, many calls to refreshItems are made and this creates a memory leak. 
    	 * It also slows down all the mapping and so it takes time for all windows to get unminimized after showDesktop is clicked.
    	 * 
    	 * For now this was removed. If it needs to be put back, this isn't the place. 
    	 * If showDesktop needs it, then it should only call it once, not once per window.
    	 */ 
        //this._refreshItems();
        this._onWindowStateChange('map', actor);
    },
  
    _windowAdded: function(metaWorkspace, metaWindow) {
       if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
           return;
       }
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                return;
            }
        }
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(metaWindow);
        if ( app && tracker.is_window_interesting(metaWindow) ) {
            let appbutton = new AppMenuButton(this, metaWindow, true, this.orientation);
            this._windows.push(appbutton);
            this.myactor.add(appbutton.actor);
            appbutton.actor.show();
        }
    },

    _windowRemoved: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                this.myactor.remove_actor(this._windows[i].actor);
                this._windows[i].actor.destroy();
                this._windows.splice(i, 1);
                break;
            }
        }
    }, 
    
    _changeWorkspaces: function() {
        for ( let i=0; i<this._workspaces.length; ++i ) {
            let ws = this._workspaces[i];
            ws.disconnect(ws._windowAddedId);
            ws.disconnect(ws._windowRemovedId);
        }

        this._workspaces = [];
        for ( let i=0; i<global.screen.n_workspaces; ++i ) {
            let ws = global.screen.get_workspace_by_index(i);
            this._workspaces[i] = ws;
            ws._windowAddedId = ws.connect('window-added',
                                    Lang.bind(this, this._windowAdded));
            ws._windowRemovedId = ws.connect('window-removed',
                                    Lang.bind(this, this._windowRemoved));
        }
    },
    
    _allocateBoxes: function(container, box, flags) {	
		let allocWidth = box.x2 - box.x1;
		let allocHeight = box.y2 - box.y1;
		let [leftMinWidth, leftNaturalWidth] = this._leftBox.get_preferred_width(-1);
		let [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
		let [rightMinWidth, rightNaturalWidth] = this._rightBox.get_preferred_width(-1);

		let sideWidth, centerWidth;
		centerWidth = centerNaturalWidth;
		sideWidth = (allocWidth - centerWidth) / 2;

		let childBox = new Clutter.ActorBox();

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.myactor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = allocWidth - Math.min(allocWidth - rightNaturalWidth,
												leftNaturalWidth);
			childBox.x2 = allocWidth;
		} else {
			childBox.x1 = 0;
			childBox.x2 = Math.min(allocWidth - rightNaturalWidth, leftNaturalWidth);
		}
		this._leftBox.allocate(childBox, flags);

		childBox.x1 = Math.ceil(sideWidth);
		childBox.y1 = 0;
		childBox.x2 = childBox.x1 + centerWidth;
		childBox.y2 = allocHeight;
		this._centerBox.allocate(childBox, flags);

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.myactor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = 0;
			childBox.x2 = Math.min(Math.floor(sideWidth),
								   rightNaturalWidth);
		} else {
			childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth),
												rightNaturalWidth);
			childBox.x2 = allocWidth;
		}
		this._rightBox.allocate(childBox, flags);
    }
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}

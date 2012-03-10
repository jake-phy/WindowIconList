const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Layout = imports.ui.layout;
const Tweener = imports.ui.tweener;
const Overview = imports.ui.overview;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const BoxPointer = imports.ui.boxpointer;
const AppFavorites = imports.ui.appFavorites;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const AltTab = imports.ui.altTab;
const Gio = imports.gi.Gio;
const Params = imports.misc.params;
const Tooltips = imports.ui.tooltips;

const Gettext = imports.gettext.domain('cinnamon-extensions');
const _ = Gettext.gettext;

const PANEL_ICON_SIZE = 24;
const SPINNER_ANIMATION_TIME = 2;

/*const OPTIONS = {
                    // GROUP_BY_APP
                    //     true: only one button is shown for each application (all windows are grouped)
                    //     false: every window has its own button
                    GROUP_BY_APP: true
                };*/
const HOVER_MENU_TIMEOUT = 500;
/*size of thumbnail less is bigger*/ 
const THUMBNAIL_SIZE = 7
const THUMBNAIL_HEIGHT = Math.max(Main.layoutManager.primaryMonitor.height / THUMBNAIL_SIZE);
const THUMBNAIL_WIDTH = Math.max(Main.layoutManager.primaryMonitor.width / THUMBNAIL_SIZE);

function HoverMenuController() {
    this._init.apply(this, arguments);
}

HoverMenuController.prototype = {
    _init: function(actor, menu, params) {
        // reactive: should the menu stay open if your mouse is above the menu
        // clickShouldImpede: if you click actor, should the menu be prevented from opening
        // clickShouldClose: if you click actor, should the menu close
        params = Params.parse(params, { reactive: true,
                                        clickShouldImpede: true,
                                        clickShouldClose: true });

        this._parentActor = actor;
        this._parentMenu = menu;

        this._parentActor.reactive = true;
        this._parentActor.connect('enter-event', Lang.bind(this, this._onEnter));
        this._parentActor.connect('leave-event', Lang.bind(this, this._onLeave));

        // If we're reactive, it means that we can move our mouse to the popup
        // menu and interact with it.  It shouldn't close while we're interacting
        // with it.
        if (params.reactive) {
            this._parentMenu.actor.connect('enter-event', Lang.bind(this, this._onParentMenuEnter));
            this._parentMenu.actor.connect('leave-event', Lang.bind(this, this._onParentMenuLeave));
        }

        if (params.clickShouldImpede || params.clickShouldClose) {
            this.clickShouldImpede = params.clickShouldImpede;
            this.clickShouldClose = params.clickShouldClose;
            this._parentActor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        }
    },

    _onButtonPress: function() {
        if (this.clickShouldImpede) {
            this.shouldOpen = false;
        }
        if (this.clickShouldClose) {
            if (!this.impedeClose) {
                this.shouldClose = true;
            }
            this.close();
        }
    },

    _onParentMenuEnter: function() {
        if (!this.impedeOpen) {
            this.shouldOpen = true;
        }
        this.shouldClose = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.open));
    },

    _onParentMenuLeave: function() {
        this.shouldClose = true;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.close));
    },

    _onEnter: function() {
        if (!this.impedeOpen) {
            this.shouldOpen = true;
        }
        this.shouldClose = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.open));
    },

    _onLeave: function() {
        if (!this.impedeClose) {
            this.shouldClose = true;
        }
        this.shouldOpen = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.close));
    },

    open: function() {
        if (this.shouldOpen && !this._parentMenu.isOpen) {
            this._parentMenu.open(true);
        }
    },

    close: function() {
        if (this.shouldClose) {
            this._parentMenu.close(true);
        }
    },

    enable: function() {
        this.impedeOpen = false;
    },

    disable: function() {
        this.impedeOpen = true;
    }
};

function HoverMenu() {
    this._init.apply(this, arguments);
}

HoverMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, params, orientation) {
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0, orientation);
	params = Params.parse(params, { reactive: true });
        this.actor.style_class = null;
	this._arrowAlignment = 0.4;
        this._parentActor = actor;
        this.actor.hide();

        if (params.reactive) {
            Main.layoutManager.addChrome(this.actor, this.orientation);
        } else {
            Main.uiGroup.add_actor(this.actor, this.orientation);
        }
    }
};

function AppThumbnailHoverMenu() {
    this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
    __proto__: HoverMenu.prototype,

    _init: function(actor, metaWindow, orientation) {
        HoverMenu.prototype._init.call(this, actor, { reactive: true }, orientation);

        this.metaWindow = metaWindow;
	let tracker = Cinnamon.WindowTracker.get_default();
        this.app = tracker.get_window_app(this.metaWindow);

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this.metaWindow, this.app);
        this.addMenuItem(this.appSwitcherItem);
    },

    open: function(animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
        this.appSwitcherItem._refresh();
        PopupMenu.PopupMenu.prototype.open.call(this, animate);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
        this.appSwitcherItem.setMetaWindow(metaWindow);
    }
}

// display a list of app thumbnails and allow
// bringing any app to focus by clicking on its thumbnail
function PopupMenuAppSwitcherItem() {
    this._init.apply(this, arguments);
}

PopupMenuAppSwitcherItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (metaWindow, app, params) {
        params = Params.parse(params, { hover: false });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.metaWindow = metaWindow;
	let tracker = Cinnamon.WindowTracker.get_default();
        this.app = tracker.get_window_app(this.metaWindow);
        

        this.appContainer = new St.BoxLayout({ style_class: 'switcher-list',
                                               reactive: true,
                                               track_hover: true,
                                               can_focus: true,
                                               vertical: false});
        this.appThumbnails = {};
        this.divider = new St.Bin({ style_class: 'separator',
                                    y_fill: true });
        this.appContainer.add_actor(this.divider);
        this._refresh();

        this.addActor(this.appContainer);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
    },

    _connectToWindowOpen: function(actor, metaWindow) {
        actor._button_release_signal_id = actor.connect('button-release-event', Lang.bind(this, function() {
            metaWindow.activate(global.get_current_time());
        }));
    },

    _refresh: function() {
        // Check to see if this.metaWindow has changed.  If so, we need to recreate
        // our thumbnail, etc.
        if (this.metaWindowThumbnail && this.metaWindowThumbnail.metaWindow == this.metaWindow) {
            this.metaWindowThumbnail._refresh();
        } else {
            if (this.metaWindowThumbnail) {
                this.metaWindowThumbnail.actor.disconnect(this.metaWindowThumbnail.actor._button_release_signal_id);
                this.metaWindowThumbnail.destroy();
            }
            // If our metaWindow is null, just move along
            if (this.metaWindow) {
                this.metaWindowThumbnail = new WindowThumbnail(this.metaWindow, this.app);
                this._connectToWindowOpen(this.metaWindowThumbnail.actor, this.metaWindow);
                this.appContainer.insert_actor(this.metaWindowThumbnail.actor, 0);
            }
        }

        // Get a list of all windows of our app that are running in the current workspace
        let windows = this.app.get_windows().filter(Lang.bind(this, function(win) {
                                                            let metaWorkspace = null;
                                                            if (this.metaWindow)
                                                                metaWorkspace = this.metaWindow.get_workspace();
                                                            let isDifferent = (win != this.metaWindow);
                                                            let isSameWorkspace = (win.get_workspace() == metaWorkspace);
                                                            return isDifferent && isSameWorkspace;
                                                    }));
        // Update appThumbnails to include new programs
        windows.forEach(Lang.bind(this, function(metaWindow) {
            if (this.appThumbnails[metaWindow]) {
                this.appThumbnails[metaWindow].thumbnail._refresh();
            } else {
                let thumbnail = new WindowThumbnail(metaWindow, this.app);
                this.appThumbnails[metaWindow] = { metaWindow: metaWindow,
                                                   thumbnail: thumbnail };
                this.appContainer.add_actor(this.appThumbnails[metaWindow].thumbnail.actor);
                this._connectToWindowOpen(this.appThumbnails[metaWindow].thumbnail.actor, metaWindow);
            }
        }));

        // Update appThumbnails to remove old programs
        for (let win in this.appThumbnails) {
            if (windows.indexOf(this.appThumbnails[win].metaWindow) == -1) {
                this.appContainer.remove_actor(this.appThumbnails[win].thumbnail.actor);
                this.appThumbnails[win].thumbnail.destroy();
                delete this.appThumbnails[win];
            }
        }

        // Show the divider if there is more than one window belonging to this app
        if (Object.keys(this.appThumbnails).length > 0) {
            this.divider.show();
	}
         else {
            this.divider.hide();
        }
    }
};

function WindowThumbnail() {
    this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {
    _init: function (metaWindow, app, params) {
        this.metaWindow = metaWindow
        this.app = app

        // Inherit the theme from the alt-tab menu
        this.actor = new St.BoxLayout({ style_class: 'item-box',
                                        reactive: true,
                                        can_focus: true,
                                        vertical: true});
        this.thumbnailActor = new St.Bin({ x_fill: false,
                                           x_align: St.Align.MIDDLE,
					   y_fill: false,
                                           y_align: St.Align.MIDDLE });
        this.thumbnailActor.height = THUMBNAIL_HEIGHT;
        this.thumbnailActor.width = THUMBNAIL_WIDTH;
        this.titleActor = new St.Label();
        //TODO: should probably do this in a smarter way in the get_size_request event or something...
        //fixing this should also allow the text to be centered
        this.titleActor.width = THUMBNAIL_WIDTH;

        this.actor.add(this.titleActor);
        this.actor.add(this.thumbnailActor);
        this._refresh();

        // the thumbnail actor will automatically reflect changes in the window
        // (since it is a clone), but we need to update the title when it changes
        this.metaWindow.connect('notify::title', Lang.bind(this, function(){
                                                    this.titleActor.text = this.metaWindow.get_title();
                                }));
        this.actor.connect('enter-event', Lang.bind(this, function() {
                                                        this.actor.add_style_pseudo_class('outlined');
                                                        this.actor.add_style_pseudo_class('selected');
                                                    }));
        this.actor.connect('leave-event', Lang.bind(this, function() {
                                                        this.actor.remove_style_pseudo_class('outlined');
                                                        this.actor.remove_style_pseudo_class('selected');
                                                    }));
    },

    destroy: function() {
        this.actor.destroy();
    },

    needs_refresh: function() {
        return Boolean(this.thumbnail);
    },

    _getThumbnail: function() {
        // Create our own thumbnail if it doesn't exist
        if (this.thumbnail) {
            return this.thumbnail;
        }

        let thumbnail = null;
        let mutterWindow = this.metaWindow.get_compositor_private();
        if (mutterWindow) {
            let windowTexture = mutterWindow.get_texture();
            let [width, height] = windowTexture.get_size();
            let scale = Math.min(1.0, THUMBNAIL_WIDTH / width, THUMBNAIL_HEIGHT / height);
            thumbnail = new Clutter.Clone ({ source: windowTexture,
                                             reactive: true,
                                             width: width * scale,
                                             height: height * scale });
        }

        return thumbnail;
    },

    _refresh: function() {
        // Replace the old thumbnail
        this.thumbnail = this._getThumbnail();

        this.thumbnailActor.child = this.thumbnail;
        this.titleActor.text = this.metaWindow.get_title();
    }
};

function AppMenuButtonRightClickMenu(actor, metaWindow, orientation) {
    this._init(actor, metaWindow, orientation);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, metaWindow, orientation) {
        //take care of menu initialization
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, orientation, 0);        
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();
        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
//        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.metaWindow = metaWindow;
	
        this.itemCloseWindow = new PopupMenu.PopupMenuItem('Close');
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate)); 
	let tracker = Cinnamon.WindowTracker.get_default();
	this.app = tracker.get_window_app(this.metaWindow); 
	let favs = AppFavorites.getAppFavorites(),
		favId = this.app.get_id(),
		isFav = favs.isFavorite(favId);
	if (isFav)
	    this.itemtoggleFav = new PopupMenu.PopupMenuItem('Remove from Favorites');
	else
	    this.itemtoggleFav = new PopupMenu.PopupMenuItem('Add To Favorites');
        this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));     
        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Restore');
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Minimize');
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        if (metaWindow.get_maximized())
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Unmaximize"));
        else
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_('Maximize'));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));        
        
        if (orientation == St.Side.BOTTOM) {
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemtoggleFav);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            this.addMenuItem(this.itemtoggleFav);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
        }
      //} 
    },

/*    _onToggled: function(actor, state){        
        if (state) {
            if (this.windowList.actor != null) {
                let coord = this.mouseEvent.get_coords();
                let panelOffset = this.windowList.actor.get_geometry().x
                let buttonOffset = actor.sourceActor.get_geometry().x;
                let buttonWidth = (actor.sourceActor.get_geometry().width / 2);
                
                this.actor.set_position((0 - buttonOffset - buttonWidth - panelOffset) + coord[0], 0);
            }
        }
    },*/
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
    },
    
    _toggleFav: function(actor, event){
	let favs = AppFavorites.getAppFavorites(),
		favId = this.app.get_id(),
		isFav = favs.isFavorite(favId);
	if (isFav){
		favs.removeFavorite(favId)
		this.itemtoggleFav.label.set_text('Add To Favorites');
	}else{
		favs.addFavorite(favId);
		this.itemtoggleFav.label.set_text('Remove from Favorites');
		}
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized)
            this.metaWindow.unminimize(global.get_current_time());
        else
            this.metaWindow.minimize(global.get_current_time());
    },

    _onMaximizeWindowActivate: function(actor, event){      
        // 3 = 1 | 2 for both horizontally and vertically (didn't find where the META_MAXIMIZE_HORIZONTAL and META_MAXIMIZE_VERTICAL constants were defined for the JS wrappers)
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(3);
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }else{
            this.metaWindow.maximize(3);
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }
    },
    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;

    }

};

function FavoritesRightClickMenu(actor, app, orientation) {
    this._init(actor, app, orientation);
}

FavoritesRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, app, orientation) {
	this.app = app
        //take care of menu initialization
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, orientation, 0);        
        Main.uiGroup.add_actor(this.actor);
        this.actor.style_class = 'popup-menu-boxpointer';
        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.actor.hide();

	this.favMenu = new PopupMenu.PopupMenuItem('Remove from Favorites');
        this.favMenu.connect('activate', Lang.bind(this, this._toggleFavMenu));
        this.addMenuItem(this.favMenu);
    },
    _toggleFavMenu: function(actor, event){
	let favs = AppFavorites.getAppFavorites(),
		favId = this.app.get_id(),
		isFav = favs.isFavorite(favId);
	if (isFav){
		favs.removeFavorite(favId)
	}
    },
    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;

    }
};

function PanelFavorites(app, orientation) {
    this._init(app, orientation);
}

PanelFavorites.prototype = {
    _init: function(app, orientation) {
        this.actor = new St.Bin({ style_class: 'panel-launcher',
								  reactive: true,
								  can_focus: true,
								  x_fill: true,
								  y_fill: false,
								  track_hover: true });
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor._delegate = this;
        this._iconBox = new Cinnamon.Slicer({ name: 'panel-launcher-icon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;

        let icon = app.create_icon_texture(PANEL_ICON_SIZE);
        this._iconBox.set_child(icon);
        let text = app.get_name();
        if ( app.get_description() ) {
            this.text += '\n' + app.get_description();
        }
        this.tooltip = new Tooltips.PanelItemTooltip(this, text, orientation);
        this._app = app;

        this._favoritesMenu = new PopupMenu.PopupMenuManager(this);
        this._favRightClickMenu = new FavoritesRightClickMenu(this.actor, orientation);
        this._favoritesMenu.addMenu(this._favRightClickMenu);
    },

    _onButtonRelease: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            if ( this._favRightClickMenu.isOpen ) {
                this._favRightClickMenu.toggle();                
            }
            this._app.open_new_window(-1);
	}
	else if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK ) {
            this._favRightClickMenu.mouseEvent = event;
            this._favRightClickMenu.toggle();   
        }   
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('panel-launcher-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
        if (this._iconBottomClip > 0)
            this._iconBox.set_clip(0, 0, allocation.x2 - allocation.x1, allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },
};

function AppMenuButton(metaWindow, animation, orientation) {
    this._init(metaWindow, animation, orientation);
}

AppMenuButton.prototype = {
//    __proto__ : AppMenuButton.prototype,

    
    _init: function(metaWindow, animation, orientation) {
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
            this._label.set_text('');
        }));
                
        this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();

		let tracker = Cinnamon.WindowTracker.get_default();
		let app = tracker.get_window_app(this.metaWindow);
		let icon = app.create_icon_texture(PANEL_ICON_SIZE);
		//let icon = this.app.get_faded_icon(1.15 * PANEL_ICON_SIZE);		        
        this._label.set_text('');
        this._iconBox.set_child(icon);
        
        if(animation){
			this.startAnimation(); 
			this.stopAnimation();
		}
        
        //set up the right click menu
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this.rightClickMenu = new AppMenuButtonRightClickMenu(this.actor, this.metaWindow, orientation);
        this._menuManager.addMenu(this.rightClickMenu);
        // Set up the hover menu
        this.hoverMenu = new AppThumbnailHoverMenu(this.actor, this.metaWindow, orientation)
        this.hoverController = new HoverMenuController(this.actor, this.hoverMenu);
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
            if ( this.metaWindow.has_focus() ) {
                this.metaWindow.minimize(global.get_current_time());
                this.actor.remove_style_pseudo_class('focus');
            }
            else {
                this.metaWindow.activate(global.get_current_time());
                this.actor.add_style_pseudo_class('focus');	    
            }
        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK) {
            this.metaWindow.delete(global.get_current_time());
            this.rightClickMenu.destroy();
        }  else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
            if (!this.rightClickMenu.isOpen) {
                // Setting the max-height won't do any good if the minimum height of the
                // menu is higher then the screen; it's useful if part of the menu is
                // scrollable so the minimum height is smaller than the natural height
                //let monitor = global.get_primary_monitor();
                //this.rightClickMenu.actor.style = ('max-height: ' +
                //                         Math.round(200) +
                //                         'px;');
            }
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();   
        }   
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
        alloc.natural_size = PANEL_ICON_SIZE +6; // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
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
    }
};

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);
        
        try {                    
            this.orientation = orientation;
        
            this.myactor = new St.BoxLayout({ name: 'windowList',
                                       	style_class: 'window-list-box' });
            this.actor.add(this.myactor);
            this.actor.reactive = false;
                                       	
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
	    this._display();
	    
	    //Cinnamon.AppSystem.get_default().connect('installed-changed', Lang.bind(this, this._redisplay));
            //AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._redisplay));
                
            let tracker = Cinnamon.WindowTracker.get_default();
            tracker.connect('notify::focus-app', Lang.bind(this, this._onFocus));

            global.window_manager.connect('switch-workspace',
                                            Lang.bind(this, this._refreshItems));
            global.window_manager.connect('minimize',
                                            Lang.bind(this, this._onMinimize));
            global.window_manager.connect('maximize',
                                            Lang.bind(this, this._onMaximize));
            global.window_manager.connect('unmaximize',
                                            Lang.bind(this, this._onMaximize));
            global.window_manager.connect('map',
                                            Lang.bind(this, this._onMap));
            
            this._workspaces = [];
            this._changeWorkspaces();
            global.screen.connect('notify::n-workspaces',
                                    Lang.bind(this, this._changeWorkspaces));
            global.display.connect('window-demands-attention', Lang.bind(this, this._onWindowDemandsAttention));
                                    
            // this._container.connect('allocate', Lang.bind(Main.panel, this._allocateBoxes));                                                                                
        }
        catch (e) {
            global.logError(e);
        }
    },

    _redisplay: function() {
        for ( let i=0; i<this._buttons.length; ++i ) {
            this._buttons[i].actor.destroy();
        }

        this._display();
    },

    _display: function() {
        let launchers = global.settings.get_strv(AppFavorites.getAppFavorites().FAVORITE_APPS_KEY);

        this._buttons = [];
        let j = 0;
        for ( let i=0; i<launchers.length; ++i ) {
            let app = Cinnamon.AppSystem.get_default().lookup_app(launchers[i]);

            if ( app == null ) {
                continue;
            }

            this._buttons[j] = new PanelFavorites(app);
            this.myactor.add(this._buttons[j].actor);
            ++j;
        }
    },
    
    on_applet_clicked: function(event) {
            
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
    
    _refreshItems: function() {
        this.myactor.destroy_children();
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
                if ( app  ) {
                    let appbutton = new AppMenuButton(metaWindow, false, this.orientation);
                    this._windows.push(appbutton);
                    this.myactor.add(appbutton.actor);
                }
            }
        }

        this._onFocus();
	this._redisplay();
    },

    _onWindowStateChange: function(state, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {
                let windowReference = this._windows[i];
                let menuReference = this._windows[i].rightClickMenu;
                
                if (state == 'minimize') {
                    windowReference._label.set_text("["+ actor.get_meta_window().get_title() +"]");
                    menuReference.itemMinimizeWindow.label.set_text(_("Restore"));
                    
                    return;
                } else if (state == 'map') {
                    windowReference._label.set_text(actor.get_meta_window().get_title());
                    menuReference.itemMinimizeWindow.label.set_text(_("Minimize"));
                    
                    return;
                } else if (state == 'maximize') {
                    if (actor.get_meta_window().get_maximized()) {
                        menuReference.itemMaximizeWindow.label.set_text(_("Unmaximize"));
                    } else {
                        menuReference.itemMaximizeWindow.label.set_text(_("Maximize"));
                    }
                    
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
        if (app && tracker.is_window_interesting(metaWindow)) {
            let appbutton = new AppMenuButton(metaWindow, true, this.orientation);
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

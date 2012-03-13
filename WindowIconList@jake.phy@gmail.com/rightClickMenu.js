const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const AppFavorites = imports.ui.appFavorites;

const Gettext = imports.gettext.domain('cinnamon-extensions');
const _ = Gettext.gettext;

const AppletDir = imports.ui.appletManager.applets['WindowIconList@jake.phy@gmail.com'];
const MainApplet = AppletDir.applet;

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
	if (isFav && MainApplet.OPTIONS['SHOW_PINNED_APPS'])
	    this.itemtoggleFav = new PopupMenu.PopupMenuItem(_('Unpin'));
	else if (MainApplet.OPTIONS['SHOW_PINNED_APPS'])
	    this.itemtoggleFav = new PopupMenu.PopupMenuItem(_('Pin'));
	if (MainApplet.OPTIONS['SHOW_PINNED_APPS'])
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
	    if (MainApplet.OPTIONS['SHOW_PINNED_APPS'])
            	this.addMenuItem(this.itemtoggleFav);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
	    if (MainApplet.OPTIONS['SHOW_PINNED_APPS'])
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
		this.itemtoggleFav.label.set_text(_('Pin'));
	}else{
		favs.addFavorite(favId);
		this.itemtoggleFav.label.set_text(_('Unpin'));
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
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0, orientation);        
        Main.uiGroup.add_actor(this.actor);
        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.actor.hide();

	this.favMenu = new PopupMenu.PopupMenuItem(_('Unpin'));
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

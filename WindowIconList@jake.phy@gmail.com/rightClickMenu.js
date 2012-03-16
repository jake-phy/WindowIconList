const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const AppFavorites = imports.ui.appFavorites;

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
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));        

        this.metaWindow = metaWindow;
	let tracker = Cinnamon.WindowTracker.get_default();
	this.app = tracker.get_window_app(this.metaWindow);

        this.itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));        

        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Restore"));
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Minimize"));
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        
        this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Maximize"));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));  
        
        this.itemMoveToLeftWorkspace = new PopupMenu.PopupMenuItem(_("Move to left workspace"));
        this.itemMoveToLeftWorkspace.connect('activate', Lang.bind(this, this._onMoveToLeftWorkspace));
        
        this.itemMoveToRightWorkspace = new PopupMenu.PopupMenuItem(_("Move to right workspace"));
        this.itemMoveToRightWorkspace.connect('activate', Lang.bind(this, this._onMoveToRightWorkspace));      
        
        this.itemOnAllWorkspaces = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
        this.itemOnAllWorkspaces.connect('activate', Lang.bind(this, this._toggleOnAllWorkspaces));

		let favs = AppFavorites.getAppFavorites(),
		favId = this.app.get_id(),
		isFav = favs.isFavorite(favId);
	if (isFav && MainApplet.OPTIONS['SHOW_PINNED_APPS']) {
	    this.itemtoggleFav = new PopupMenu.PopupMenuItem(_('Unpin'));
            this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));     
	}
	else if (MainApplet.OPTIONS['SHOW_PINNED_APPS']) {
	    this.itemtoggleFav = new PopupMenu.PopupMenuItem(_('Pin'));
            this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));
	} 

        if (orientation == St.Side.BOTTOM) {
            this.addMenuItem(this.itemOnAllWorkspaces);
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	    if (MainApplet.OPTIONS['SHOW_PINNED_APPS'])
            	this.addMenuItem(this.itemtoggleFav);
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
	    if (MainApplet.OPTIONS['SHOW_PINNED_APPS'])
            	this.addMenuItem(this.itemtoggleFav);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(this.itemOnAllWorkspaces);
        }
     },

     _onToggled: function(actor, event){
	if (!event)
            return;

	if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.set_text(_("Only on this workspace"));
            this.itemMoveToLeftWorkspace.actor.hide();
            this.itemMoveToRightWorkspace.actor.hide();
        } else {
            this.itemOnAllWorkspaces.label.set_text(_("Visible on all workspaces"));
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace())
                this.itemMoveToLeftWorkspace.actor.show();
            else
                this.itemMoveToLeftWorkspace.actor.hide();
            
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace())
                this.itemMoveToRightWorkspace.actor.show();
            else
                this.itemMoveToRightWorkspace.actor.hide();
        }
        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }else{
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }
    },
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
        this.destroy();
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
            this.metaWindow.activate(global.get_current_time());
        }
        else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function(actor, event){      
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }else{
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },
    
    _onMoveToLeftWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT); 
        if (workspace) {
            this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _onMoveToRightWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT); 
        if (workspace) {
            this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _toggleOnAllWorkspaces: function(actor, event) {
        if (this.metaWindow.is_on_all_workspaces())
            this.metaWindow.unstick();
        else
            this.metaWindow.stick();
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

function FavoritesRightClickMenu(launcher, app, orientation) {
    this._init(launcher, app, orientation);
}

FavoritesRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(launcher, app, orientation) {
	this.app = app
        //take care of menu initialization
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
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

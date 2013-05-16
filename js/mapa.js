/*
 * IDE Chubut
 * 
 * Escrito por Bruno J. Vecchietti
 * 
 * mapa.js
 * 
 * Script inicial
 * 
 */

OpenLayers.ProxyHost = "/cgi-bin/proxy.cgi?url=";

Ext.onReady(function() {
    
    Ext.QuickTips.init();  //initialize quick tips   
    wmsServerStore.loadData(servidoresWMS); //inicializa el almacen de servidores                  
    createMap();    //crea el mapa
    generateViewport(); //crea el viewport   
    finalConfig();  // configuración final
    
});

function createMap(){               

    map = new OpenLayers.Map(
        "divMapa",
        {
            controls: [
                new OpenLayers.Control.NavigationHistory(),
                new OpenLayers.Control.PanZoomBar(),
                new OpenLayers.Control.Navigation(),                   
                new OpenLayers.Control.WMSGetFeatureInfo(featureInfoOptions)        
            ],
            restrictedExtent: max_bounds.clone().transform(projection4326, projectionMercator),  
            projection: projectionMercator,
            displayProjection: projection4326, 
            units: 'm'
        }
    );                    
        
//    map.addLayer(new OpenLayers.Layer.CloudMade(
//        'Cloudmade', 
//        {key: 'f4f58cc6030c410388fc3de3e13af3e1', styleId: '95838'},
//        {useCanvas: OpenLayers.Layer.Grid.ONECANVASPERLAYER}
//    ));     

    var resolutions = OpenLayers.Layer.Bing.prototype.serverResolutions.slice(6, 19);

    map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap",null,{zoomOffset: 6, resolutions: resolutions, isBaseLayer:true, sphericalMercator: true}));    
    map.addLayer(new OpenLayers.Layer.Google("Google Streets",{minZoomLevel: 6, maxZoomLevel: 19}));
    map.addLayer(new OpenLayers.Layer.Google("Google Terrain",{type: google.maps.MapTypeId.TERRAIN, minZoomLevel: 6, maxZoomLevel: 15}));
    map.addLayer(new OpenLayers.Layer.Google("Google Satellite",{type: google.maps.MapTypeId.SATELLITE, minZoomLevel: 6, maxZoomLevel: 19}));
    map.addLayer(new OpenLayers.Layer.Google("Google Hybrid",{type: google.maps.MapTypeId.HYBRID, minZoomLevel: 6, maxZoomLevel: 19}));
    map.addLayer(new OpenLayers.Layer.Bing({name: "Bing Road", key: bingApiKey, type: "Road", zoomOffset: 6, resolutions: resolutions}));
    map.addLayer(new OpenLayers.Layer.Bing({name: "Bing Aerial", key: bingApiKey, type: "Aerial", zoomOffset: 6, resolutions: resolutions}));
    map.addLayer(new OpenLayers.Layer.Bing({name: "Bing Hybrid", key: bingApiKey, type: "AerialWithLabels", zoomOffset: 6, resolutions: resolutions}));

    map.setCenter(new OpenLayers.LonLat(-69, -44).transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject()), 0);
    // vector layer para dibujo
    vectors = new OpenLayers.Layer.Vector("Vectores", {displayInLayerSwitcher: false}); 
    map.addLayer(vectors); 
    
    // vector layer para wfs
    wfsLayer = new OpenLayers.Layer.Vector("wfsLayer", {displayInLayerSwitcher: false});                    
    map.addLayer(wfsLayer);
    
}

function generateViewport(){
    
    var rootnode = new Ext.tree.TreeNode({
        text: "Capas",
        icon: "img/layers.png",
        leaf:false,
        expanded: true          
    });
    
    mapPanel = new GeoExt.MapPanel({
        map: map,   
        id: "mapPanel",
        extent: max_bounds.clone().transform(projection4326, projectionMercator),
        region: "center",
        stateId: "map",
        border:true,
        prettyStateKeys: true // for pretty permalinks
    });
    
//    rootnode.appendChild(new GeoExt.tree.BaseLayerContainer({
//        text: "Capas Base",
//        map: map,
//        expanded: false               
//    }));
    
    agregarDescendencia(rootnode,tree);
    restoreIndex(index);
    
    layerTreePanel = new Ext.tree.TreePanel({
        flex:1,
        autoScroll: true,
        title: 'Capas',
        id: "myTreePanel",
        root: rootnode,
        rootVisible: false,
        border: false,
        enableDD: true,
        useArrows: true,
        tbar:[             
            new Ext.Toolbar.Button({
                tooltip: 'Agregar capa',
                icon: 'img/map_add.png',
                handler: function(){
                    agregarCapas(null);
                }
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Importar capas',
                icon: 'img/folder-open.png',
                handler: onImportarCapas
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Guardar capas',
                icon: 'img/folder-save.png',
                handler: onGuardarCapas
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Agregar carpeta',
                icon: 'img/folder-add.png',
                handler: function(){
                   var newFolder = createNode("Nueva carpeta");
                   Ext.getCmp("myTreePanel").getRootNode().appendChild(newFolder);
                   setFolderName(newFolder);
                }
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Expandir todo',
                icon: 'img/list-add.png',
                handler: function(){
                   expandAll(Ext.getCmp("myTreePanel").getRootNode());
                }
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Colapsar todo',
                icon: 'img/list-remove.png',
                handler: function(){
                   collapseAll(Ext.getCmp("myTreePanel").getRootNode());
                }
            })
        ]
    });           
    
    legendPanel = new GeoExt.LegendPanel({
        title: 'Leyenda',
        flex:1,
        autoScroll: true,
        width: 250,
        collapsible: false,
        collapsed: false,
        border: false,
        defaults: {
            style: 'padding:5px',
            baseParams: {
                FORMAT: 'image/png',
                LEGEND_OPTIONS: 'forceLabels:on'
            }
        }
    });    
        
    featureGridpanel = new Ext.grid.GridPanel({
        viewConfig: {forceFit: false},
        border: false,
        store: [],
        sm: new GeoExt.grid.FeatureSelectionModel(),
        columns: []
    });               
    
    var wfsReconocer = new Ext.Toolbar.Button({
         id: "wfsReconocerButton",
         tooltip: 'Reconocer',
         text:"Reconocer",
         icon: 'img/cursor-question.png',
         toggleGroup: "nav", 
         allowDepress: true,
         listeners: {
            toggle: function(){
                
                if(wfsReconocerControl != null){
                    if(this.pressed){
                        wfsReconocerControl.activate();
                    }else{
                        wfsReconocerControl.deactivate();
                    }                    
                }
                
            }
         }
     });
     
     var wfsSeleccionar = new Ext.Toolbar.Button({
         id: "wfsSeleccionarButton",
         tooltip: 'Seleccionar',
         text:"Seleccionar",
         icon: 'img/cursor.png',
         toggleGroup: "nav", 
         allowDepress: true,
         listeners: {
            toggle: function(){

                if(wfsSelectControl != null){
                    if(this.pressed){
                        wfsSelectControl.activate();
                    }else{
                        wfsSelectControl.deactivate();
                    }                    
                }

            }
         }
     });
     
     var wfsFiltrar = new Ext.Toolbar.Button({
         tooltip: 'Filtrar',
         icon: 'img/funnel.png',
         handler: function(){

         }
     });
     
     var wfsBorrar = new Ext.Toolbar.Button({
         tooltip: 'Limpiar',
         text:"Limpiar",
         icon: 'img/broom.png',
         handler: function(){
            wfsLayer.removeAllFeatures();
         }
     });     
    
    //defino el viewport 
    new Ext.Viewport({
            layout: "border",  
            border:false,
            items:[
                {
                    region: 'north',
                    height: 40,
                    bodyStyle:'background-color:black',
                    border:false,
                    html: '<img src="img/banner.jpg" alt="banner" style="height: 100%">'
                },
                {
                    layout: 'border',
                    region: 'center',
                    border:false,
                    items:[
                        {
                            region: 'north',
                            collapseMode: 'mini',
                            split: true,
                            height: 25,
                            maxHeight: 25,
                            minHeight: 25,
                            border:false,
                            tbar: getTopBar()
                        },
                        {
                            region: 'west',
                            collapseMode: 'mini',
                            split: true,
                            layout: {
                                type: 'vbox',
                                align: 'stretch'
                            },
                            width: 250,
                            maxWidth: 250,
                            minWidth: 250,
                            items:[layerTreePanel, legendPanel]
                        },
                        {
                            region: 'center',
                            border:false,
                            layout: 'border',
                            items: [
                                mapPanel,
                                {
                                    id: "wfsPanel",
                                    title: "WFS",
                                    region: 'south',
                                    collapseMode: 'mini',
                                    collapsed: true,
                                    split: true,
                                    height: 200,
                                    minHeight: 200,
                                    maxHeight: 200,
                                    tbar: [
                                        wfsReconocer, 
                                        wfsSeleccionar, 
                                        wfsBorrar
                                    ],
                                    items:[featureGridpanel]
                                }                                
                            ]
                        }

                    ]
                }
            ]
    });    
    
}

function finalConfig(){

    var mapdiv = document.getElementById('mapPanel').firstChild.firstChild.firstChild;
    mapdiv.appendChild(document.getElementById('scalelinediv'));
    mapdiv.appendChild(document.getElementById('scalecombodiv'));
    mapdiv.appendChild(document.getElementById('position'));
    mapdiv.appendChild(document.getElementById('minimapcontainer'));
//    mapdiv.appendChild(document.getElementById('mapBackground'));
    mapdiv.appendChild(document.getElementById('rosa'));

    permalinkProvider = new GeoExt.state.PermalinkProvider({encodeType: false}); // create permalink provider    
    Ext.state.Manager.setProvider(permalinkProvider); // set it in the state manager                   
    
    map.addControl(new OpenLayers.Control.MousePosition({
        div: document.getElementById('position'),
        prefix: '<b>lon:</b> ',
        separator: '&nbsp; <b>lat:</b> ' 
    }));     

    var scaleCombo = new Ext.form.ComboBox({
        width: 130,
        mode: "local", // keep the combo box from forcing a lot of unneeded data refreshes
        emptyText: "Scale",
        triggerAction: "all", // needed so that the combo box doesn't filter by its current content
        displayField: "scale",
        editable: false,
        tpl: '<tpl for="."><div class="x-combo-list-item">1 : {[parseInt(values.scale)]}</div></tpl>',
        renderTo: document.getElementById("scalecombodiv"),
        store: new GeoExt.data.ScaleStore({map: map}),
        listeners: {
            select: function(combo, record) {
                mapPanel.map.zoomTo(record.get("level"));
                scaleCombo.setValue("1 : " + parseInt(map.getScale()));
            }
        }
    });
    
    map.addControl(new OpenLayers.Control.ScaleLine({
        div: document.getElementById("scalelinediv")
    }));
    
    map.addControl(new OpenLayers.Control.OverviewMap({
        layers:[new OpenLayers.Layer.OSM("OSM",null,null,{isBaseLayer: true, maxZoomLevel: 20})],
        size: new OpenLayers.Size(180, 155),
        div: document.getElementById('minimap')            
    }));       
    
    map.events.register("zoomend", this, function() {
        scaleCombo.setValue("1 : " + parseInt(map.getScale()));
    });
    
    scaleCombo.setValue("1 : " + parseInt(map.getScale()));
       
}


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
                new OpenLayers.Control.Navigation(),                   
                new OpenLayers.Control.WMSGetFeatureInfo(featureInfoOptions)        
            ],
            resolutions: resolutions,
            restrictedExtent: max_bounds.clone().transform(projection4326, projectionMercator),  
            projection: projectionMercator,
            displayProjection: projection4326, 
            units: 'm'
        }
    );     
        
    map.addControl(new OpenLayers.Control.PanZoomBar(),new OpenLayers.Pixel(6,2));    
        
//    map.addLayer(new OpenLayers.Layer.CloudMade(
//        'Cloudmade', 
//        {key: 'f4f58cc6030c410388fc3de3e13af3e1', styleId: '95838'},
//        {useCanvas: OpenLayers.Layer.Grid.ONECANVASPERLAYER}
//    ));     
   
//    map.addLayer(new OpenLayers.Layer.WMS(
//        "IGN", 
//        "http://172.158.0.21/geoserver/wms", 
//        {layers: "rural:basemap", transparent: 'false', styles:"", format: 'image/jpeg', tiled: true, tilesOrigin : map.maxExtent.left + ',' + map.maxExtent.bottom}, 
//        {isBaseLayer: true, visibility: false, singleTile: true, displayInLayerSwitcher: false, buffer: 0, yx : {'EPSG:4326' : true}}
//    ));
                    
    map.addLayer(new OpenLayers.Layer.Google("Google Streets",{minZoomLevel: 6, maxZoomLevel: 19}));
    map.addLayer(new OpenLayers.Layer.Google("Google Terrain",{type: google.maps.MapTypeId.TERRAIN, minZoomLevel: 6, maxZoomLevel: 15}));
    map.addLayer(new OpenLayers.Layer.Google("Google Satellite",{type: google.maps.MapTypeId.SATELLITE, minZoomLevel: 6, maxZoomLevel: 19}));
    map.addLayer(new OpenLayers.Layer.Google("Google Hybrid",{type: google.maps.MapTypeId.HYBRID, minZoomLevel: 6, maxZoomLevel: 19}));
    map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap",null,{zoomOffset: 6, resolutions: resolutions, isBaseLayer:true, sphericalMercator: true}));    
    map.addLayer(new OpenLayers.Layer.Bing({name: "Bing Road", key: bingApiKey, type: "Road", zoomOffset: 6, resolutions: resolutions}));
    map.addLayer(new OpenLayers.Layer.Bing({name: "Bing Aerial", key: bingApiKey, type: "Aerial", zoomOffset: 6, resolutions: resolutions}));
    map.addLayer(new OpenLayers.Layer.Bing({name: "Bing Hybrid", key: bingApiKey, type: "AerialWithLabels", zoomOffset: 6, resolutions: resolutions}));
    map.addLayer(new OpenLayers.Layer.OSM("mapquest",
        ["http://otile1.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.jpg",
        "http://otile2.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.jpg",
        "http://otile3.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.jpg",
        "http://otile4.mqcdn.com/tiles/1.0.0/map/${z}/${x}/${y}.jpg"],
        {zoomOffset: 6, resolutions: resolutions, isBaseLayer:true, sphericalMercator: true}
    ));  
        
    map.addLayer(new OpenLayers.Layer.OSM("mapquestAerial",
        ["http://otile1.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg",
        "http://otile2.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg",
        "http://otile3.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg",
        "http://otile4.mqcdn.com/tiles/1.0.0/sat/${z}/${x}/${y}.jpg"],
        {zoomOffset: 6, resolutions: resolutions2, isBaseLayer:true, sphericalMercator: true}
    ));    
        
    map.setCenter(new OpenLayers.LonLat(-69, -44).transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject()), 0);
    // vector layer para dibujo
    vectors = new OpenLayers.Layer.Vector("Vectores", {displayInLayerSwitcher: false}); 
    map.addLayer(vectors); 
    
    // vector layer para wfs
    wfsLayer = new OpenLayers.Layer.Vector("wfsLayer", {displayInLayerSwitcher: false});                    
    map.addLayer(wfsLayer);
    
    map.addLayer(locationLayer);
    
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
        border:false,
        prettyStateKeys: true, // for pretty permalinks,
        tbar: getTopBar(),
        bbar: [
            "<div id='scalecombodiv'></div>",
            "->",
            "<div id='position'></div>"
        ]
    });
    
    agregarDescendencia(rootnode,tree);
    restoreIndex(index);       
    
    layerTreePanel = new Ext.tree.TreePanel({
        autoScroll: true,
        region: "center",
        iconCls: "layers-headerIcon",
        title: 'Capas',
        id: "myTreePanel",
        root: rootnode,
        rootVisible: false,
        border: false,
        enableDD: true,
//        useArrows: true,
        tbar:[ 
            new Ext.Toolbar.Button({
                tooltip: 'Agregar capa',
                icon: 'img/map-plus.png',
                id: "treePanelTopbarAgregar",
                handler: function(){
                    agregarCapas(null);
                }
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Orden',
                icon: 'img/maps-stack.png',
                enableToggle: true,
                allowDepress: true,
                handler: function(){        
                    if(this.pressed){
                        Ext.getCmp("treePanelTopbarAgregar").disable();
                        Ext.getCmp("treePanelTopbarAgregarCarpeta").disable();
                        Ext.getCmp("treePanelTopbarExpandir").disable();
                        Ext.getCmp("treePanelTopbarColapsar").disable();
                        Ext.getCmp("treePanelBottombarImportar").disable();
                        Ext.getCmp("treePanelBottombarExportar").disable();  
                        Ext.getCmp("myTreePanel").root = null;
                        Ext.getCmp("myTreePanel").setRootNode(new GeoExt.tree.OverlayLayerContainer({
                            text: "Solo overlays",
                            icon: "img/layers.png",
                            map: map,
                            expanded: false
                        }));
                    }else{
                        Ext.getCmp("treePanelTopbarAgregar").enable();
                        Ext.getCmp("treePanelTopbarAgregarCarpeta").enable();
                        Ext.getCmp("treePanelTopbarExpandir").enable();
                        Ext.getCmp("treePanelTopbarColapsar").enable();
                        Ext.getCmp("treePanelBottombarImportar").enable();
                        Ext.getCmp("treePanelBottombarExportar").enable();
                        Ext.getCmp("myTreePanel").setRootNode(rootnode);
                    }
                }
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Agregar carpeta',
                icon: 'img/folder-add.png',
                id: "treePanelTopbarAgregarCarpeta",
                handler: function(){
                   var newFolder = createNode("Nueva carpeta");
                   Ext.getCmp("myTreePanel").getRootNode().appendChild(newFolder);
                   setFolderName(newFolder);
                }
            }),    
            new Ext.Toolbar.Button({
                tooltip: 'Expandir todo',
                icon: 'img/list-add.png',
                id: "treePanelTopbarExpandir",
                handler: function(){
                   expandAll(Ext.getCmp("myTreePanel").getRootNode());
                }
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Colapsar todo',
                icon: 'img/list-remove.png',
                id: "treePanelTopbarColapsar", 
                handler: function(){
                   collapseAll(Ext.getCmp("myTreePanel").getRootNode());
                }
            })
        ],
        bbar: [            
            {
                icon: "img/map.png",
                text: "Mapa Base",
                menu: new Ext.menu.Menu({
                    items: [
                        {
                            text: "Google Streets",
                            iconCls: "googleIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Google Streets")[0]);
                            }
                        },
                        {
                            text: "Google Terrain",
                            iconCls: "googleIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Google Terrain")[0]);
                            }
                        },
                        {
                            text: "Google Satellite",
                            iconCls: "googleIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Google Satellite")[0]);
                            }
                        },
                        {
                            text: "Google Hybrid",
                            iconCls: "googleIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Google Hybrid")[0]);
                            }
                        },
                        {
                            text: "OpenStreetMap",
                            iconCls: "osmIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("OpenStreetMap")[0]);
                            }
                        },                                
                        {
                            text: "Bing Road",
                            iconCls: "bingIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Bing Road")[0]);
                            }
                        },
                        {
                            text: "Bing Aerial",
                            iconCls: "bingIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Bing Aerial")[0]);
                            }
                        },
                        {
                            text: "Bing Hybrid",
                            iconCls: "bingIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("Bing Hybrid")[0]);
                            }
                        },
                        {
                            text: "mapquest",
                            iconCls: "mapQuestIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("mapquest")[0]);
                            }
                        },
                        {
                            text: "mapquestAerial",
                            iconCls: "mapQuestIcon",
                            handler: function(){
                                map.setBaseLayer(map.getLayersByName("mapquestAerial")[0]);
                            }
                        }                       
                    ]
                })
            },
            "->",
            new Ext.Toolbar.Button({
                tooltip: 'Importar capas',
                icon: 'img/folder-open.png',
                id: "treePanelBottombarImportar",
                handler: onImportarCapas
            }),
            new Ext.Toolbar.Button({
                tooltip: 'Guardar capas',
                icon: 'img/folder-save.png',
                id: "treePanelBottombarExportar",
                handler: onGuardarCapas
            })        
        ]
    });     
    

    
    legendPanel = new GeoExt.LegendPanel({
        title: 'Leyenda',
        id: "legendRightPanel",
        region: "center",
        iconCls: "legendIcon",
        autoScroll: true,
        width: 250,
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
        id: "featureGridPanel",
        viewConfig: {forceFit: false},
        border: false,
        columnLines: true,
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
                    height: 30,
                    bodyStyle:'background-color:black',
                    border:false,
                    html: '<img src="img/banner-dgeyc.jpg" alt="banner" style="height: 100%">'
                },
                {
                    layout: 'border',
                    region: 'center',
                    border:false,
                    items:[
                        {
                            region: 'west',
                            collapseMode: 'mini',
                            split: true,
                            layout: "border",
                            width: 255,
                            maxWidth: 255,
                            minWidth: 255,
                            border: false,
                            items:[layerTreePanel]
                        },
                        {
                            region: 'east',
                            collapseMode: 'mini',
                            collapsed: true,
                            split: true,
                            layout: "border",
                            width: 255,
                            maxWidth: 255,
                            minWidth: 255,
                            border:false,
                            items:[legendPanel]
                        },                        
                        {
                            region: 'center',
                            border:false,
                            layout: 'border',
                            items: [
//                                {
//                                    region: 'north',
//                                    collapseMode: 'mini',
//                                    collapsed: false,
//                                    split: true,
//                                    border: false,
//                                    tbar: getTopBar()
//                                },
                                mapPanel                               
                            ]
                        },
                        {
                            id: "wfsPanel",
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
                                wfsBorrar,
                                "->",
                                new Ext.ux.Exporter.Button({store: wfsStoreExport})
                            ],
                            items:[featureGridpanel]
                        }                         

                    ]
                }
            ]
    });  
    
    featureGridpanel.setWidth(mapPanel.getWidth() - 3);
    
}

function finalConfig(){

    var mapdiv = document.getElementById('mapPanel').getElementsByClassName('x-panel-body')[0].firstChild;
    mapdiv.appendChild(document.getElementById('scalelinediv'));
    mapdiv.appendChild(document.getElementById('minimapcontainer'));
    mapdiv.appendChild(document.getElementById('rosa'));
    mapdiv.appendChild(document.getElementById('titulodiv'));
    mapdiv.appendChild(document.getElementById('subtitulodiv'));
    mapdiv.appendChild(document.getElementById('legenddiv'));

    permalinkProvider = new GeoExt.state.PermalinkProvider({encodeType: false}); // create permalink provider    
    Ext.state.Manager.setProvider(permalinkProvider); // set it in the state manager                   
    
    map.addControl(new OpenLayers.Control.MousePosition({
        div: document.getElementById('position'),
        formatOutput: function(lonLat) {
            var markup = convertDMS(lonLat.lat, "LAT");
            markup += " " + convertDMS(lonLat.lon, "LON");
            return markup
        }
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
        size: new OpenLayers.Size(150, 130),
        div: document.getElementById('minimap')            
    }));       
    
    map.events.register("zoomend", this, function() {
        scaleCombo.setValue("1 : " + parseInt(map.getScale()));
    });
    
    scaleCombo.setValue("1 : " + parseInt(map.getScale()));
    
    legendPanel2 = new GeoExt.LegendPanel({
        title: 'Leyenda',
        iconCls: "legendIcon",
        id: "legendPanel",
        autoScroll: true,
        width: 250,
//        height: mapPanel.getHeight() - 203,
        collapsible: false,
        collapsed: false,
        border: false,
        renderTo: document.getElementById("legenddiv"),
        bodyCfg : { cls:'x-panel-body your-own-rule' , style: {'background':'rgba(255, 255, 255, 0.6)'} },
        defaults: {
            style: 'padding:5px',
            baseParams: {
                FORMAT: 'image/png',
                LEGEND_OPTIONS: 'forceLabels:on'
            }
        }
    });  

    mapPanel.on("bodyresize", function(){
        legendPanel2.setHeight(mapPanel.getHeight() - 73);
        Ext.getCmp("featureGridPanel").setWidth(Ext.getCmp("wfsPanel").getWidth() - 3);
    });
    
    document.getElementById("myTreePanel").getElementsByClassName('x-panel-bwrap')[0].getElementsByClassName('x-panel-tbar')[0].firstChild.style.backgroundColor = "#BACAE6";
    document.getElementById("myTreePanel").getElementsByClassName('x-panel-bwrap')[0].getElementsByClassName('x-panel-tbar')[0].firstChild.style.borderBottomColor = "#BACAE6";
    document.getElementById("myTreePanel").getElementsByClassName('x-panel-bwrap')[0].getElementsByClassName('x-panel-bbar')[0].firstChild.style.backgroundColor = "#BACAE6";
    document.getElementById("myTreePanel").getElementsByClassName('x-panel-bwrap')[0].getElementsByClassName('x-panel-bbar')[0].firstChild.style.borderTopColor = "#BACAE6";
    document.getElementById("myTreePanel").getElementsByClassName('x-panel-header')[0].style.height = "17px";
    document.getElementById("legendRightPanel").getElementsByClassName('x-panel-header')[0].style.height = "17px";
  
//    legendPanel2.setHeight(mapPanel.getHeight() - 73);
    

       
}


var Ext = window.Ext4 || window.Ext;
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function() {
        var that = this;

        // console.log(that.getSettings());
        that.TimeCriticalityField = that.getSetting('TimeCriticalityField');
        that.RROEValueField = that.getSetting('RROEValueField');
        that.UserBusinessValueField = that.getSetting('UserBusinessValueField');
        that.WSJFScoreField = that.getSetting('WSJFScoreField');
        that.JobSizeField = that.getSetting('JobSizeField');
        that.ShowValuesAfterDecimal = that.getSettingsFields('ShowValuesAfterDecimal');
        // that.FieldsText = that.getSetting("Fields");
        // that.Fields = [];

        // // trim the fields.
        // if (!_.isUndefined(that.FieldsText)&&!_.isNull(that.FieldsText)) {
        //     that.Fields = that.FieldsText.split(",");
        //     _.each(that.Fields,function(field){ 
        //         field = field.trim();
        //     });
        // }
        that.calculatedFields = that._getCalculatedFields();

        that.Weightings = JSON.parse(that.getSetting("Weightings"));
        that.ValueMappings = JSON.parse(that.getSetting("ValueMappings"));
        console.log("w",that.Weightings);
        console.log("v",that.ValueMappings);
        
        this._grid = null;
        this._piCombobox = this.add({
            xtype: "rallyportfolioitemtypecombobox",
            padding: 5,
            listeners: {
                //ready: this._onPICombobox,
                select: this._onPICombobox,
                scope: this
            }
        });
    },

    _getCalculatedFields : function() {

        var settingName = "CalculatedField";
        var cfs = [];

        for( x = 1; x <= 2; x++) {
            var fieldText = this.getSetting('CalculatedField'+x);
            var calcField = {};
            if (!_.isUndefined(fieldText)&&!_.isNull(fieldText)&&(fieldText!="")) {
                var parts = fieldText.split(",");
                calcField["field"] = parts[0];
                calcField["formula"] = parts[1];
                cfs.push(calcField);
            }
        }
        return cfs;
    },

    _getWeightings : function() {

        return this.Weightings;

    },

    _getValueMappings : function() {

        return this.ValueMappings;

    },



    // returns true if the value should be mapped.
    _isMappableField : function(fieldName,record) {

        var value = record.get(fieldName);

        // console.log("value",value,typeof(value),parseInt(""+value),!_.isNaN(parseInt(""+value)));

        // dont map if empty, or a numeric value.
        if ( _.isNull(value) || value==""|| _.isNumber(value)||
             !_.isNaN(parseInt(""+value)) )
            return false;
        else    
            return true;
    },

    _mapValue : function(value,field) {

        // console.log("mapping",value,field);

        var mappings = this._getValueMappings();
        var key = _.has(mappings,field) ? field : 'default';
        // console.log("key",key)
        var mapping = mappings[key];
        // console.log(field + ":mapping",value,"to",mapping[value]);
        return _.has(mapping,value) ? mapping[value] : 0;
    },

    _applyWeigthing : function( fieldName, value ) {

        var weightings = this._getWeightings();
        var weight = 1;

        if ( _.has( weightings, fieldName ) ) {
            // return value * weightings[fieldName];
            weight = weightings[fieldName];
        }
        // else
        //     return value;
        // console.log("weighting:",fieldName,"value",value,"weight",weight,"wvalue",(weight*value));
        return (weight*value);
    },

    _calcValue : function(record,calcField) {
        // console.log("_calcValue");

        var that = this;
        var regex = /\w{2,50}/g ;

        var replacer = function(fieldName) {

            var value;

            if (that._isMappableField(fieldName,record)) {
                // console.log("got value",record.get(fieldName),"from",fieldName);
                value =  that._mapValue(record.get(fieldName),fieldName);
            }
            else
                value = record.get(fieldName);

            return that._applyWeigthing( fieldName, value );
        }
        // use regex to get field names from formula
        // replace with values
        // then eval it.
        var formula = calcField['formula'].replace(regex,replacer);
        var value;

        try {
            // console.log("formula",formula);
            value = eval(formula);
            value = !_.isNumber(value) || _.isNaN(value) || !_.isFinite(value) ? 0 : value;
            console.log("formula:",formula,"value",value);
        } catch (e) {
            return {
                value : 0,
                error : e.message
            }
        }
        

        return {
            value : (Math.round(value * 100) / 100),
            error : null
        }
    },
    
    _onPICombobox: function() {
        var selectedType = this._piCombobox.getRecord();
        var model = selectedType.get('TypePath');
        var that = this;
        
        if (this._grid !== null) {
            this._grid.destroy();
        }

        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: [ model ],
            listeners: {
                // load: function(store) {
                //     var records = store.getRootNode().childNodes;
                //     this._calculateScore(records);
                // },
                update: function(store, rec, modified, opts) {
                    // console.log(modified,opts);
                    // that.calculatedFields
                    
                    if (modified=="edit" && opts.length==1 
                        && (!_.contains(_.pluck(that.calculatedFields,'field'),opts[0])))    {
                        // console.log(rec,modified,opts);
                        this._calculateScore([rec]);
                    }
                },
                scope: this
            },
           // autoLoad: true,
            enableHierarchy: true
        }).then({
            success: this._onStoreBuilt,
            scope: this
        });
    },
    
    _onStoreBuilt: function(store, records) {
        //var records = store.getRootNode().childNodes;
  
        var selectedType = this._piCombobox.getRecord();
        var modelNames = selectedType.get('TypePath');

        var columns = ['Name'];
        var context = this.getContext();
        
        this._grid = this.add({
            xtype: 'rallygridboard',
            context: context,
            modelNames: [ modelNames ],
            toggleState: 'grid',
            stateful: false,
            plugins: [
                {
                    ptype: 'rallygridboardcustomfiltercontrol',
                    filterChildren: false,
                    filterControlConfig: {
                        modelNames: [ modelNames ],
                        stateful: true,
                        stateId: context.getScopedStateId('custom-filter-example')
                    }
                },
                {
                    ptype: 'rallygridboardfieldpicker',
                    headerPosition: 'left',
                    modelNames: [ modelNames ],
                    stateful: true,
                    stateId: context.getScopedStateId('columns-example')
                },
                {
                    ptype: 'rallygridboardactionsmenu',
                    menuItems: [
                        {
                            text: 'Export...',
                            handler: function() {
                                window.location = Rally.ui.grid.GridCsvExport.buildCsvExportUrl(
                                    this.down('rallygridboard').getGridOrBoard());
                            },
                            scope: this
                        }
                    ],
                    buttonConfig: {
                        iconCls: 'icon-export'
                    }
                }
            ],
            gridConfig: {
                store: store,
                columnCfgs : columns
            },
            height: this.getHeight()
        });
    },
    
    _calculateScore: function(records)  {
        // console.log("_calculateScore");
        var that = this;

        Ext.Array.each(records, function(feature) {
            console.log(feature.get("FormattedID"));
            _.each(that.calculatedFields,function(calcField) {
                var oldValue = feature.get(calcField.field);
                var value = that._calcValue(feature,calcField);
                if (_.isNull(value.error)) {
                    if (!_.isNull(value.value) && value.value!==oldValue)
                        feature.set(calcField.field, value.value);
                }
                else
                    console.log("formula error:",value.error)
            })
        })

    },
    
    getSettingsFields : function() {
        var values = [

            {
                name: 'CalculatedField1',
                width : 800,
                xtype: 'rallytextfield',
                label : "Calculated Field 1",
                labelWidth: 200
            },
            {
                name: 'CalculatedField2',
                width : 800,
                xtype: 'rallytextfield',
                label : "Calculated Field 2",
                labelWidth: 200
            },
            {
                name: 'ValueMappings',
                width : 800,
                xtype:'textareafield',
                grow: true,
                label : "Field Value Mappings",
                labelWidth: 200
            },
            {
                name: 'Weightings',
                width : 800,
                xtype:'textareafield',
                grow: true,
                label : "Field Value Weightings",
                labelWidth: 200
            }



        ];

        return values;
    },

    config: {
        defaultSettings : {
            ValueMappings : _getValueMappingsString(),
            Weightings    : _getWeightingsString(),
            CalculatedField1 : "",
            CalculatedField2 : ""
        }
    }
});

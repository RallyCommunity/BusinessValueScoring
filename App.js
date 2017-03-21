var Ext = window.Ext4 || window.Ext;
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function() {
        var that = this;

        that.calculatedFields = that._getCalculatedFields();

        that.Weightings = JSON.parse(that.getSetting("Weightings"));
        that.ValueMappings = JSON.parse(that.getSetting("ValueMappings"));

        this._grid = null;
        this._piCombobox = this.add({
            xtype: "rallyportfolioitemtypecombobox",
            padding: 5,
            listeners: {
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

        // dont map if empty, or a numeric value.
        if ( _.isNull(value) || value==""|| _.isNumber(value)||
             !_.isNaN(parseInt(""+value)) )
            return false;
        else    
            return true;
    },

    _mapValue : function(value,field) {

        var mappings = this._getValueMappings();
        var key = _.has(mappings,field) ? field : 'default';
        var mapping = mappings[key];
        return _.has(mapping,value) ? mapping[value] : 0;
    },

    _applyWeigthing : function( fieldName, value ) {

        var weightings = this._getWeightings();
        var weight = 1;

        if ( _.has( weightings, fieldName ) ) {
            // return value * weightings[fieldName];
            weight = weightings[fieldName];
        }
        return (weight*value);
    },

    _calcValue : function(record,calcField) {
        
        var that = this;
        var regex = /\w{2,50}/g ;

        var replacer = function(fieldName) {

            var value;

            if (that._isMappableField(fieldName,record)) {
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
                    if (modified=="edit" && opts.length==1 
                        && (!_.contains(_.pluck(that.calculatedFields,'field'),opts[0])))    {
                        this._calculateScore([rec]);
                    }
                },
                scope: this
            },
           // autoLoad: true,
            enableHierarchy: true
        }).then({
            success: function(store,records) {
                var that = this;
                var selectedType = this._piCombobox.getRecord();
                var modelNames = selectedType.get('TypePath');

                Rally.data.ModelFactory.getModel({
                    type: modelNames,
                    success: function(model) {
                        that._onStoreBuilt(store,records,model)
                    }
                });    
            },
            scope: this
        });
    },
    
    _onStoreBuilt: function(store, records,model) {

        // validate the fields in the formula
        var diffFields = this._allFieldsValid(model);
        // show an error if there are any invalid fields
        if (diffFields.length>0) {
            Ext.Msg.alert('Status', 'Invalid fields in formula:' + diffFields);
            return
        }

  
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

     // validates that the formula fields are valid ie. are part of the model. 
    // returns an the invalid field name if not or null if good.
    _allFieldsValid : function(model) {

        var validFields = _.map( model.getFields(), function(f) { return f.name; });

        var allFields = [];
        var that = this;
        _.each(this.calculatedFields,function(cf){
            allFields.push(cf.field); 
            allFields = allFields.concat( _getFormulaFields(cf.formula));
        });
        allFields = _.uniq(allFields);

        var diff = _.difference(allFields, validFields);
        return diff;
    },

    _allFieldsSet : function(fields,feature) {
        var allSet = true;
        _.each(fields,function(field){
            var value = feature.get(field);
            if (_.isNull(value)||_.isUndefined(value)||value=="")
                allSet = false;
        });
        return allSet;
    },
    
    _calculateScore: function(records)  {
        var that = this;

        Ext.Array.each(records, function(feature) {
            console.log(feature.get("FormattedID"));
            _.each(that.calculatedFields,function(calcField) {
                var fields = _getFormulaFields(calcField.formula);
                // only update if required fields are set
                if (that._allFieldsSet(fields,feature)) { 
                    var oldValue = feature.get(calcField.field);
                    var value = that._calcValue(feature,calcField);
                    if (_.isNull(value.error)) {
                        if (!_.isNull(value.value) && value.value!==oldValue)
                            feature.set(calcField.field, value.value);
                    }
                    else
                        console.log("formula error:",value.error)
                } else {
                    // set it to zero if not all fields set.
                    feature.set(calcField.field, 0);
                }
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

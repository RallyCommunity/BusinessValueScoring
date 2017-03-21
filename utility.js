
// console.log(JSON.parse(_getValueMappingsString()));
// console.log(JSON.parse(_getWeightingsString()));

// var formula = "(c_SalesProfitability + c_CostSavings + c_CustomerExperience + c_AgentExperience + c_RiskMitigationCompliance + c_Urgency + c_RiskFactorOfNotDoing + c_Foundational)";
// console.log(_getFormulaFields(formula));

function  _getFormulaFields(formula) {

        var regex = /\w{2,50}/g;
        var m;
        var fields = [];
        do {
            m = regex.exec(formula);
            if (m) {
                fields.push(m[0])
            }
        } while (m);
        return fields;

}


function _getValueMappingsString() {

        return '{\n\
            "default" : {\n\
                "NA" : 0,\n\
                "L" : 1,\n\
                "M" : 5,\n\
                "H" : 10\n\
            },\n\
            "c_RiskFactorOfNotDoing" : {\n\
                "NA" : 0,\n\
                "L"  : 5,\n\
                "M"  : 10,\n\
                "H"  : 25\n\
            },\n\
            "c_Foundational" : {\n\
                "NA" : 0,\n\
                "L"  : 5,\n\
                "M"  : 10,\n\
                "H"  : 25\n\
            },\n\
            "c_BusinessLevelOfEffort" : {\n\
                "NA" :  0,\n\
                "XS" :  1,\n\
                "S"  :  2,\n\
                "M"  :  3,\n\
                "L"  :  5,\n\
                "XL" :  8\n\
            },\n\
            "c_ITLevelOfEffort" : {\n\
                "NA" :  0,\n\
                "XS" :  1,\n\
                "S"  :  2,\n\
                "M"  :  3,\n\
                "L"  :  5,\n\
                "XL" :  8\n\
            }\n\
        }\n';

}
    
function _getWeightingsString() {

        return '{\n\
            "c_SalesProfitability" : 4.8,\n\
            "c_CostSavings" : 1.7,\n\
            "c_CustomerExperience" : 3.4,\n\
            "c_AgentExperience" : 2.2,\n\
            "c_RiskMitigationCompliance" : 2.9,\n\
            "c_Urgency" : 1,\n\
            "c_RiskFactorOfNotDoing" : 1,\n\
            "c_Foundational" : 1\n\
        }\n';

}
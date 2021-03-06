/* This is a content script that runs in the tab itself*/

browser.runtime.onMessage.addListener(run_func);
function run_func(message) {
    console.log("calling run_func in borderify.js")
    if(message.greeting === "run"){
        console.log("refreshed");
        find_fields();
    }
    if(message.message === "start"){
        console.log("clicked");
        find_fields();
        document.getElementById("autofill-warning-div").style.display = "none";

    }
}


/*
These regular expressions were taken from
https://source.chromium.org/chromium/chromium/src/+/main:out/chromeos-Debug/gen/components/autofill/core/browser/pattern_provider/default_regex_patterns.cc;
*/

const company_re = /company|business|organization|organisation/;

const addr1_re  = /^address$|address[_-]?line(one)?|address1|addr1|street|(?:shipping|billing)address$|house.?name/;
const addr1_re2 = /(^\\W*address)|(address\\W*$)|(?:shipping|billing|mailing|pick.?up|drop.?off|delivery|sender|postal|recipient|home|work|office|school|business|mail)[\\s\\-]+address|address\\s+(of|for|to|from)|street.*(house|building|apartment|floor)|(house|building|apartment|floor).*street/;

const addr2_re  = /address[_-]?line(2|two)|address2|addr2|street|suite|unit|address|line/;
const addr3_re  = /address.*line[3-9]|address[3-9]|addr[3-9]|street|line[3-9]/;

const country_re = /country|countries/;
const zip_re     = /zip|postal|post.*code|pcode|pin.?code/;


const city_re          = /city|town|suburb/;
const state_re         = /(?<!(united|hist|history).?)state|region|province|county|principality/;
const email_re         = /e.?mail/;
const fullname_re      = /^name|full.?name|your.?name|customer.?name|bill.?name|ship.?name|name.*first.*last|firstandlastname|contact.?(name|person)/;
const firstname_re     = /first.*name|initials|fname|first$|given.*name/;
const mid_init_re      = /middle.*initial|m\\.i\\.|mi$|\\bmi\\b/;
const midname_re       = /middle.*name|mname|middle$/;
const lastname_re      = /last.*name|lname|surname(?!\\d)|last$|secondname|family.*name/;
const phone_re         = /phone|mobile|contact.?number/;
const phone_country_re = /country.*code|ccode|_cc|phone.*code|user.*phone.*code/;
const phone_area_re    = /area.*code|acode|area/;
const phone_ext_re     = /\\bext|ext\\b|extension/;
//let re = //;

const regs = [
    company_re,
    addr1_re,
    addr1_re2,
    addr2_re,
    addr3_re,
    country_re,
    zip_re,
    city_re,
    state_re,
    email_re,
    fullname_re,
    firstname_re,
    mid_init_re,
    midname_re,
    lastname_re,
    phone_re,
    phone_country_re,
    phone_area_re,
    phone_ext_re,
];




// check if el has a name that could be exploited by autofill
var hasRelevantName = (el) => {


    let name = el.getAttribute("name");
    let type = el.getAttribute("type");
    let placeholder = el.placeholder;
    let autocomplete = el.autocomplete;
    let labels = el.labels;


    // label, placeholder, autocomplete and name fields all have impact on autofillability


    if (name) {
        name = name.toLowerCase();
    }
    if (type) {
        type = type.toLowerCase();
        if (type === "checkbox" || type === "radio" || type === "submit") {
            return false;
        }
    }
    if (placeholder) {
        placeholder = placeholder.toLowerCase();
    }
    if (autocomplete) {
        autocomplete = autocomplete.toLowerCase();
        if (autocomplete !== "off" && autocomplete !== 'on') return true;
    }

    for (let regex of regs) {

        if (name && !name.startsWith("form")) {
            if (regex.test(name)) return true;
        }
        if (regex.test(placeholder)) return true;

        if (labels) {
            for (let label of labels) {
                if (regex.test(label.innerHTML.toLowerCase())) return true;
            }

        }


    }

    return false;

}

var recursivePropHasValue = (el, property,value, stopName="BODY") => {
    var prop = window.getComputedStyle(el).getPropertyValue(property);
    if (prop === value) return true;

    let parent = el.parentNode;
    if (parent.nodeName === stopName || parent.nodeName === "BODY") return false;

    return recursivePropHasValue(parent, property, value);
};

// recursively sums up the "margin-left" of all elements going from the input element
// up until the parent form element.
var getRecursivePropertySum = (el, property) => {
    var prop = parseInt(window.getComputedStyle(el).getPropertyValue(property));
    let parent = el.parentNode;
    if (parent.nodeName === "BODY" || parent.nodeName === "BODY") return prop;

    return prop + getRecursivePropertySum(parent, property);
};


var getRecursivePropertyProduct = (el, property) => {
    var prop = parseFloat(window.getComputedStyle(el).getPropertyValue(property));
    let parent = el.parentNode;
    if (parent.nodeName === "BODY" || parent.nodeName === "BODY") return prop;

    return prop*getRecursivePropertyProduct(parent, property);
};

var recursiveAttrHasValue = (el, attr,value) => {
    var prop = el[attr];
    if (prop === value) return true;

    let parent = el.parentNode;
    if (parent.nodeName === "FORM" || parent.nodeName === "BODY") return false;

    return recursiveAttrHasValue(parent, attr, value);
};


function hiddenBehindOtherElement(el) {

    var el_box = el.getBoundingClientRect();

    var top_els =  document.elementsFromPoint(el_box.x + el_box.width/2, el_box.y + el_box.height/2);

    for (let i = 0; i< top_els.length; i++) {
        let top_el = top_els[i];
        if (top_el === el) return false;

        if (top_el.contains(el)) continue;
        let computedStyle = window.getComputedStyle(top_el);


        if(recursiveAttrHasValue(top_el, "hidden", true) ||
            computedStyle.visibility === 'hidden' ||
            computedStyle.visibility === "collapse" ||
            // computedStyle.zIndex == 0 ||
            getRecursivePropertyProduct(top_el, "opacity") < 0.1 ||
            // computedStyle.opacity == 0 ||
            recursivePropHasValue(top_el, "display", "none")
            // computedStyle.display == 'none'
            // recursivePropHasValue(el2, "display", "none", "BODY")) continue;
        ) continue;

        console.log("hidden el,", el, top_el);
        return true;

    }


    return false;
}



var hasAncestorOverflow = (el) => {
    /* Check if el is invisible because it has overflowed an ancestor with hidden overflow */

    let node = el;
    let parent = node.parentNode;
    var parent_style;
    while (parent.nodeName !== "FORM" && parent.nodeName !== "BODY") {
        parent_style = window.getComputedStyle(parent);
        if (parent_style.overflow === 'hidden') {
            let parent_box = parent.getBoundingClientRect();
            let el_box = el.getBoundingClientRect();
            // check if element is outside of parent's box
            if (el_box.left   >= parent_box.right || el_box.right <= parent_box.right ||
                el_box.bottom >= parent_box.top   || el_box.top   <= parent_box.bottom) {
                return true;
            }

        }
        if (parent_style.overflowX === 'hidden') {
            let parent_box = parent.getBoundingClientRect();
            let el_box = el.getBoundingClientRect();
            // check if element is outside of parent's box
            if (el_box.left   >= parent_box.right || el_box.right <= parent_box.left) {
                return true;
            }

        }
        if (parent_style.overflowY === 'hidden') {
            let parent_box = parent.getBoundingClientRect();
            let el_box = el.getBoundingClientRect();
            // check if element is outside of parent's box
            if (el_box.bottom >= parent_box.top   || el_box.top   <= parent_box.bottom) {
                return true;
            }

        }
        node   = parent;
        parent = node.parentNode;
    }


    return false
};

var isHiddenByMargins = (el) => {
    /* Check if el is hidden because its margins have moved it off the visible page*/


    // get current scrolling location on page
    let oldX = window.scrollX;
    let oldY = window.scrollY;

    let w = (window.innerWidth );// || document.documentElement.clientWidth);
    let h = (window.innerHeight);// || document.documentElement.clientHeight);

    // scroll to current location of element in question
    let box = el.getBoundingClientRect();

    // check if element in bounds
    // trivial reject
    if (box.right  > 0 && box.left < w &&
        box.bottom > 0 && box.top < h) {
        return false
    }

    window.scrollTo(oldX + box.x, oldY +  box.top);
    // window.scrollTo(0, box.y -  250);



    box = el.getBoundingClientRect();

    if (box.right < 0) {
        console.log("left of screen");
    }
    if (box.left > w ) {
        console.log("right of screen");
    }
    if (box.bottom < 0) {
        console.log("top of screen");
    }
    if (box.top > h) {
        console.log("bottom of screen");
    }

    // scroll back to old location so user experience isn't affected
    window.scrollTo(oldX, oldY);


    // get location of element when it has been scrolled to,
    // check if out of bounds of pages
    if (box.right  < 0 || box.left > w ||
        box.bottom < 0 || box.top > h) {
        return true
    }
    return false;
};



function investigateInputs(inputs, form_num) {
    /* Investigate a given collection of inputs */
    var form_inputs = [];
    let formHasVisibleRelevantInput = false;
    let formHasHiddenRelevantInput  = false;

    var pageSuspicious = false;
    var bool_props = ["display_none", "no_opacity", "hidden_attr", "visibility_hidden", "hidden_behind", "no_width", "ancestor_overflow", "margin_hidden"]


    for (let i = 0; i < inputs.length; i++) {
        let input = inputs[i];
        form_inputs.push({
            'element': input,
            'name': input.name ? input.name : input.type ? input.type : "None",
            'isSuspicious': false,
            'hasRelevantName': hasRelevantName(input),
            'form_num': form_num,
        });


        bool_props.forEach((prop) => {
            form_inputs[i][prop] = false;
        });

        // only look at inputs which have autofillable names
        if (form_inputs[i].hasRelevantName) {
            let computedStyle = window.getComputedStyle(input);
            if (hiddenBehindOtherElement(input)) {
                console.log("hiddenBehindOtherElement attack");
                form_inputs[i].isSuspicious  = true;
                form_inputs[i].hidden_behind = true;
                formHasHiddenRelevantInput   = true;
            }

            // check for display:none attack
            if (recursivePropHasValue(input, "display", "none")) {
                console.log("display none attack");
                form_inputs[i].isSuspicious = true;
                form_inputs[i].display_none = true;
                formHasHiddenRelevantInput = true;
            }

            // check for opacity attack
            if (getRecursivePropertyProduct(input, "opacity") < 0.1) {
                console.log("opacity attack");
                form_inputs[i].isSuspicious = true;
                form_inputs[i].no_opacity   = true;
                formHasHiddenRelevantInput = true;
            }

            // check for 'hidden' attack
            if (recursiveAttrHasValue(input, "hidden", true)) {
                console.log("hidden attack");
                form_inputs[i].isSuspicious = true;
                form_inputs[i].hidden_attr  = true;
                formHasHiddenRelevantInput = true;
            }

            // check for  visibilit='hidden' or 'collapse' attack
            if (computedStyle.visibility === 'hidden' || computedStyle.visibility === 'collapse') {
                console.log("visibility hidden attack");
                form_inputs[i].isSuspicious      = true;
                form_inputs[i].visibility_hidden = true;
                formHasHiddenRelevantInput       = true;
            }

            // check for 0 width or height
            if (window.getComputedStyle(input).width === "0px" ||
                window.getComputedStyle(input).height === "0px") {
                console.log("width attack");
                form_inputs[i].isSuspicious = true;
                form_inputs[i].no_width     = true;
                formHasHiddenRelevantInput  = true;

            }

            if (hasAncestorOverflow(input)) {
                console.log("ancestor overflow attack");
                form_inputs[i].isSuspicious      = true;
                form_inputs[i].ancestor_overflow = true;
                formHasHiddenRelevantInput       = true;
            }

            if (isHiddenByMargins(input)) {
                console.log("margin attack");
                form_inputs[i].isSuspicious  = true;
                form_inputs[i].margin_hidden = true;
                formHasHiddenRelevantInput   = true;
            }


            if (!form_inputs[i].isSuspicious) {
                formHasVisibleRelevantInput = true
            }
        }


    }

    console.log("form inputs", form_inputs);

    // to count as a proper attack, a form must have:
    // (1) At least ONE visible field with a relevant name
    // (2) At least ONE hidden field with a relevant name
    console.log(formHasVisibleRelevantInput);
    console.log(formHasHiddenRelevantInput);
    if (formHasVisibleRelevantInput && formHasHiddenRelevantInput) {
        pageSuspicious = true;
        console.log('form has visible relevant input and hidden relevant input');
    }

    for (let inp of form_inputs) {
        inp.formSuspicious = pageSuspicious;
    }

    let result =  {"formSuspicious": pageSuspicious, "inputs": form_inputs};

    return result;

}

// The body of this function will be executed as a content script inside the
// current page
function investigatePage() {
    // get all forms on a page
    const forms  = document.getElementsByTagName("FORM");
    var inputs;
    var all_inputs  = [];
    var form_num = 0;


    let pageSuspicious = false;

    for (let form of forms) {
        console.log(`There are ${forms.length} forms`);
        // get all inputs that are a child of this form
        inputs      =  form.querySelectorAll("INPUT, SELECT");
        let info = investigateInputs(inputs, form_num);
        console.log('info', info);

        if (info.formSuspicious) {
            pageSuspicious = true;
        }

        all_inputs.push(...info.inputs);
        form_num += 1;
    }


    // get all inputs that are not a child of a form
    // they count as a single form for our purposes
    var formless_inputs = [];
    var ins = document.querySelectorAll("INPUT, SELECT");
    for (let inp of ins) {
        if (!inp.closest("form")) {
            formless_inputs.push(inp);
        }
    }
    let info = investigateInputs(formless_inputs, form_num);
    console.log('formless info', info);

    if (info.formSuspicious) {
        pageSuspicious = true;
    }

    all_inputs.push(...info.inputs);


    if (pageSuspicious) {
        var susList = "<ul>";
        for (let inp of all_inputs) {
            if (inp.isSuspicious) {
                susList += "<li>" + inp.name + "</li>";
            }
        }
        susList += "</ul>";



        var warning_div = document.getElementById("autofill-warning-div")

        let warn_inner  = `<div style="padding:20px;background-color:red;color:white;border-radius:15px;font-weight: bold;width:50%;margin: 15% auto;">
            <span id="autofill-warn-close" style="float:right;font-size: 28px;font-weight: bold;">&times;</span> AutofillSecurity: Warning! This form has the following hidden values, indicating that it may be trying to steal these values from you using autofill:' ${susList}
            </div>`;
        if (warning_div) {
            warning_div.innerHTML = warn_inner;
        }
        else {
            var warning           = document.createElement('div');
            warning.id            = "autofill-warning-div";
            warning.style.cssText = "position: fixed;z-index: 100;left: 0;top: 0;width: 100%;height: 100%;overflow: auto;";

            // warning.style.cssText = "padding:20px;background-color:red;color:white;border-radius:15px;font-weight: bold;width:50%;margin: 15% auto;";
            warning.innerHTML     = warn_inner;

            document.body.appendChild(warning);
            document.getElementById ("autofill-warn-close").addEventListener ("click", () => {
                warning.style.display = "none";
            });

            // window.onclick = function(event) {
            window.addEventListener ("click", () => {
                if (event.target == warning) {
                    warning.style.display = "none";
                }
            });



        }
    }

    return {'pageSuspicious': pageSuspicious, 'inputs': all_inputs};

}



function find_fields() {
    var results = investigatePage();
    console.log("Investigated page: ", results);

    browser.runtime.sendMessage({
        "count": results.inputs.length,
        "fields": JSON.stringify(results.inputs),
        "pageSuspicious": JSON.stringify(results.pageSuspicious),
    });

}
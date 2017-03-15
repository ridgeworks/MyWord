//
// pkgs/defines.mmk : a MyWord package which substitutes named 'refs' from named values in a definition list.
//
// To use this package, @import it, e.g., @import pkgs/defines.mmk (See MyWord reference for @import details.)
//
// A reference is just a '%(name)' markup, e.g, %(launch_date), %(author)
//

% = var_ref

// Generate a <myword-ref> custom element with default content equal to the reference name wrapped in <mark> element.
//    Undefined references will be left as marked text.
var_ref :: (content) => ((ref = markit('text',content)) => `<myword-ref name="${ref}"><mark>%${ref}</mark></myword-ref>`)()

//
// A definition list is a block of name-value pairs marked by label '%defines', .e.g.,
//
// %define
//     launch_date  June 30, 2016
//     author       John Doe
// A %define is a definitions list wrapped in a <myword-def> custom element.
//

%define = <myword-def> defineslist

// transform 'deflist' is included with core lingo (see Myword Lingo)
defineslist :: (content) => `<dl class=var_define>${markit('deflist', content)}</dl>`

// substitution is inline markup matching inline '%' refs
@css    myword-ref * {display:inline}

// javascript for <myword-def> custom element
@javascript
  // <myword-def> define name value pairs and write value to named <myword-ref>'s
  ( () => {
      class MyWordDef extends HTMLElement {
          constructor() { super(); }
          connectedCallback() {
            var defs = this.firstChild.children           // <myword-def><dl>...
            var var_name, var_value, var_p, refs
            for (var def=0; def < defs.length; def++) {   // defs.length is even number for <dt><dl> pairs
            var_name = defs[def].innerText      // name in <dt>
                var_value = defs[++def].innerHTML   // use innerHTML   ; console.log(var_name,'=',var_value)
                refs = this.parentElement.querySelectorAll('myword-ref[name="' + var_name + '"]')
                for (var r = 0; r < refs.length; r++) {
                  refs[r].innerHTML = var_value
                } // for
            } // for
          } // connectedCallback()
      } // MyWordDef

      if (!customElements.get('myword-def'))
        customElements.define('myword-def', MyWordDef)
  })()

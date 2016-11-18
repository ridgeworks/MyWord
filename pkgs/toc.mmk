//
// pkgs/toc.mmk : a MyWord package to generate a table of contents from custom labelled header elements <h1..h6>.
//    The generated TOC entries are links to the actual headers in the document.
//
// To use this package, just @import it, e.g., @import pkgs/toc.mmk (See MyWord reference for @import details.)
//
// To generate a table of contents, use one of the following labels (or define your own). These labels
//    generate a custom element, <myword-toc>, and attributes minlevel and maxlevel specify the range (1 to 6)
//    of headers to be included in the table of contents. The contents of .toc markup appear as a title line
//    prior to the generated table, e.g.,
//    .toc    :h3(Table of Contents)
//    generates a table of headers h1 to h4 in the document with title 'Table of Contents' styled as an h3 header.

.toc      = <myword-toc minlevel=1 maxlevel=4>
.toc-all  = <myword-toc>

//  To be eligible a header must be in the range specified in the .toc label definition and have the custom
//    attribute defined. These defintions should be used rather than the core lingo's # .. ###### to achieve
//    the desired results.
#.        = <h1 data-myword-toc>
##.       = <h2 data-myword-toc>
###.      = <h3 data-myword-toc>
####.     = <h4 data-myword-toc>
#####.    = <h5 data-myword-toc>
######.   = <h6 data-myword-toc>


// The javascript required to implement the <myword-toc> custom element.
//    Note: uses v0 of HTML5 custom element spec; requires polyfill on some browsers.

@javascript
  // <myword-toc> table of contents
  (function () {
	  
  class MyWordTOC extends HTMLElement {
      constructor() {
        super();
        this._minlevel = 1;
        this._maxlevel = 6;
      } // constructor()

    connectedCallback() {
      var oldTOC = this.querySelector('.toc')
      if (oldTOC) // if .toc already there, remove then rebuild
        oldTOC.parentNode.removeChild(oldTOC)
      var level
      level = this.getAttribute('minlevel')
      this._minlevel = (level) ? level : this._minlevel
      level = this.getAttribute('maxlevel')
      this._maxlevel = (level) ? level : this._maxlevel
      var hselector = []
      for (var level = this._minlevel; level<= this._maxlevel; level++ ) {
        hselector.push('h' + level.toString() + '[data-myword-toc]')
      }
      var headers = document.querySelectorAll(hselector.join(', '))
      var header, header_id, tocContent = ['<div>', this.innerHTML, '<table class=toc>']
      for (var h = 0; h < headers.length; h++) {
        header = headers[ h ]
        header_id = header.id
        if (!header_id) {
          // create a fragment id from the header text
          header_id = 'toc' + header.textContent.trim().replace(/[^\w$-@.&!*(),]/g, '_')
          header.id = header_id
        }
        tocContent.push('<tr><td><a href="#', header_id, '">', header.innerHTML, '</a></td></tr>\n')
      } // for
      tocContent.push('</table></div>')
      this.innerHTML = tocContent.join('')
    } // connectedCallback()
  } // MyWordTOC

  if (!customElements.get('myword-toc'))
    customElements.define('myword-toc', MyWordTOC)

  })()

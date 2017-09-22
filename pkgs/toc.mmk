@doc
	###	`toc.mmk`
	This package generates a simple table of contents from elements with id attributes matching a specific pattern: `/toc\d[\s\S]*/`. The digit following the `toc` prefix is the level as described below, and the remaining part of the id is generted from the text content of the element. The generated TOC entries will be linked to the elements whose `id` matches the pattern.
	
	A table of contents is generated by first defining a block label which uses the type `toc`, e.g.,
	&  myTOC <- toc 1 4
	The parameters for this type are the minimum and maximum levels (default to 0 and 9 respectively) to be included in the table of contents. In this example, all `toc elements between levels 1 and 4 will be included. The content of the block is the "title" of the table, e.g.,
	eg  myTOC  **Table of Contents**
	will generate a table of contents with the title **Table of Contents** whose `toc id`'s have a level between 1 and 4.
	
	This package just defines the `toc` type (no label defintions); to use it:
	eg  &  @import pkgs/toc.mmk
// to terminate @doc without a blank line.

toc :: (title, minmax) => {
	     var levels = /(\d)\s+(\d)/.exec(minmax)
	     if (!levels) levels = ['', '0', '9']
	       return `<myword-toc minlevel=${levels[1]} maxlevel=${levels[2]}>${markit('myword', title)}</myword-toc>`
	   }

// The javascript required to implement the <myword-toc> custom element.
//    Note: uses v1 of HTML5 custom element spec; may require polyfill on some older browsers.

@javascript
	// <myword-toc> table of contents
	( () => {

		class MyWordTOC extends HTMLElement {
			constructor() {
				super();
				this._minlevel = 0;
				this._maxlevel = 9;
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
				var headers = document.querySelectorAll('*[id^=toc]')
				var tocContent = [`${this.innerHTML}<table class=toc>`]
				headers.forEach((header) => {
					var level = Number.parseInt(header.id[3])  // id='tocN...'
					if ((level >= this._minlevel) && (level <= this._maxlevel))
						tocContent.push(`<tr><td><a href="#${header.id}">${header.innerHTML}</a></td></tr>\n`)
				})
				tocContent.push('</table>')
				this.innerHTML = tocContent.join('')
			} // connectedCallback()
		} // MyWordTOC

		if (!customElements.get('myword-toc'))
		customElements.define('myword-toc', MyWordTOC)

	})()

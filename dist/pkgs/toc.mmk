@doc .myw
	####  Package `toc.mmk`
	
	This package generates a simple table of contents from elements with id attributes matching a specific pattern:
	`/toc\d[\s\S]*/`. (The default lingo generates this pattern for all `#` headers.) The digit following the `toc` 
	prefix is the level (`#` is level 1 and `#####` is level 5) and the remaining part of the id is generated from the
	text content of the element. The generated table entries will be linked to the elements whose `id` matched the
	pattern.
	
	A table of contents is generated by first defining a block notation which uses the parameterized type `toc` defined
	in this package. The parameters for this type are the minimum and maximum levels (default to 0 and 9 respectively)
	to be included in the table of contents. An example for the document you're now viewing:
	demo
		myTOC>  **Table of Contents**
		&
			myTOC> .. <- toc 1 3
			@css myword-toc { font-size:smaller; }
	In this case, all `toc` elements between levels 1 and 3 will be included. The content of the block is the "title"
	of the table.
	
	The transform for type `toc` generates a custom element `<myword-toc>` which is bound to the JavaScript class
	`MyWordTOC` which is part of the package. The element contains attributes defining the minimum and maximum levels
	for the table of contents as well as the generated HTML for the title content. When the element gets added to the 
	DOM, the `connectedCallback` method will create a table (of contents) from all the elements containing an `id` 
	matching the `toc` pattern and insert it into the `<myword-toc>` element after the title. The various items in the 
	table are indented according to their level.
	
	Additonal CSS rules can be applied to using the custom element tag name, i.e., `myword-toc`.

	Note: To render this documentation, define:
	eg
		metadoc :: (doc) => markit('myword', doc.replace(/(\n|\r\n?)(\t|[ ]{4})/g, '\n'))
	and `@import` this package.
	
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
				var oldTOC = this.querySelector('div.my_toc')
				if (oldTOC) // if .toc already there, remove then rebuild
					oldTOC.parentNode.removeChild(oldTOC)
				var level
				level = this.getAttribute('minlevel')
				this._minlevel = (level) ? level : this._minlevel
				level = this.getAttribute('maxlevel')
				this._maxlevel = (level) ? level : this._maxlevel
				var headers = document.querySelectorAll('*[id^=toc]')
				var tocContent = [`${this.innerHTML}<div class=my_toc>`]
				var closing = 0  // number of open nested list items
				var currentlevel = this._minlevel - 1
				headers.forEach((header) => {
					var level = Number.parseInt(header.id[3])  // id='tocN...'
					if ((level >= this._minlevel) && (level <= this._maxlevel)) {
						if (currentlevel >= level)      // unindent
							tocContent.push('</div>'.repeat(currentlevel - level + 1))
						if (level > (currentlevel + 1))  // deeply nested
							tocContent.push('<div class=my_listitem style="list-style-type:none">'.repeat(level - (currentlevel + 1)))
						tocContent.push(  // add a list item with a link
							`<div class=my_listitem><a href="#${header.id}">${header.innerHTML}</a>`
						)
						closing = closing + level - currentlevel
						currentlevel = level
					}
				})
				tocContent.push('</div>'.repeat(closing+1))  // close open list items and outer div.my_toc
				this.innerHTML = tocContent.join('')
			} // connectedCallback()
		} // MyWordTOC

		if (!customElements.get('myword-toc'))
		customElements.define('myword-toc', MyWordTOC)

	})()

@doc
	###	`demo.mmk`
	This package provides useful block notations for software documentation: examples and side-by-side demos. These notations are available by importing this package into your document:
	
	 `&   @import pkgs/demo.mmk`
// to terminate @doc without a blank line.


eg ..        <- <div class='eg'> text


demoS ..     <- <div class='demo'> demo

demo         :: (content) =>
	              `<div class='A1'><div class=hscroll>${markit('text',content)}</div></div>
	               <div class='B1'>${markit('myword',content)}</div>
	              `


demo ..      <- <div class='demo'> demoI

demoI        :: (content) =>
	             `<div class='A1'><div class=hscroll><myword-editable>${markit('text', content)}</myword-editable></div></div>
	              <div class='B1'><myword-sink data-source='.A1' data-type=myword>${markit('myword', content)}</myword-sink></div>
	             `


demoH ..     <- <div class='demo'> demoIH

demoIH       :: (content) => (
	              (source = content, html = markit('myword', content)) =>
	                `<div class=trow>
	                  <div class='A1'><div class=hscroll><myword-editable>${markit('text', source)}</myword-editable></div></div>
	                  <div class='B1'><myword-sink data-source='.A1' data-type=myword>${html}</myword-sink></div>
	                </div>
	                <div class=trow>
	                  <div style='display:table-cell; vertical-align:top'><button onclick='((toHide) => toHide.hidden = !toHide.hidden) (this.parentElement.nextElementSibling)'>Toggle HTML Display</button></div>
	                  <div class='A3' hidden><div><myword-sink data-source='.B1>myword-sink'>${markit('text', html)}</myword-sink></div></div>
	                </div>`
	            ) ()


// CSS to control appearance
@css
	div.eg {overflow-x:auto;}

	div.demo {
		display:table; table-layout:fixed; width:100%;
		border-spacing:5pt 0pt;
	}
	
	div.demo div.trow {display:table-row;}
	
	div.demo div.A1, div.demo div.B1 {display:table-cell;}

	div.eg, div.demo div.A1 {
		padding-left:10pt; padding-right:10pt; padding-top:5pt; padding-bottom:5pt;
		white-space:pre; font-family:monospace; background:whitesmoke;
	}

	div.demo div.A1 {width:50%; vertical-align:top;}

	div.demo div.A1 div.hscroll {overflow-x:auto;}

	div.demo div.B1 {vertical-align:top;}

	div.demo div.A3 {
		vertical-align:top;
		padding-left:10pt; padding-right:10pt;
		white-space:pre; font-family:monospace; background:whitesmoke;
	}

	div.demo div.A3 div {overflow-x:auto;}

	myword-editable {display:block; word-wrap:normal; overflow-x:inherit;}
	myword-editable:focus {outline:none; background:lightyellow;}

//	/*RWW.eg, table.demo {margin:5pt 0pt;}*/

// Javascript to implement custom elements (v1) for interactive demos.
@javascript
	( () => {
		// <myword-editable> - editable element permitting tab input
		class MyWordEditable extends HTMLElement {
		
			constructor() {
				super()
				this.contentEditable = true
				this.keyHandler = this.keydown.bind(this)  // initialize event handler bound to this object
			} // constructor()
			
			connectedCallback() {
				this.addEventListener('keydown', this.keyHandler)
			} // connectedCallback()
			
			disconnectedCallback() {
				this.removeEventListener('keydown', this.keyHandler)
			} // disconnectedCallback()
			
			keydown(event) {
				//console.log('keydown='+event.key)
				// Safari, Chrome issue: 
				//   auto scroll doesn't happen if 'insertText'ing off the right, corrects on any other key
				if (!event.defaultPrevented) {  // Safari, Chrome issue: only insert if not defaultPrevented already
					if (event.key === 'Tab' || event.keyCode == 9 || event.which == 9) {
						document.execCommand('insertText', false, '\t')
						event.preventDefault()
					} else if (event.key === 'Enter' || event.keyCode == 13 || event.which == 13) {
						// Work around for FireFox changing leading tab to a space
						try {
							document.execCommand('insertText', false, '\n')
						} catch (err) { /*console.debug(err)*/ }  // first time on Firefox, ignore?
						this.scrollLeft = 0  // for Safari, Chrome auto-scroll issue
						event.preventDefault()
					}
				}
				return false    // don't lose focus
			} // keyHandler(event)
								
		} // MyWordEditable

		if (!customElements.get('myword-editable'))
			customElements.define('myword-editable', MyWordEditable)

		// <myword-sink> - monitor a source for change and transform source.contents to this.contents
		class MyWordSink extends HTMLElement {
		
			constructor() {
				super()
				this.sourceObserver = new MutationObserver((mutations, observer) => {
					if (observer.type) {
						observer.sink.textContent = observer.source.innerText || observer.source.textContent
						window.postMessage({type: observer.type, selector: this.tagName.toLowerCase()+'#'+this.id}, '*')
					} else {
						observer.sink.textContent = observer.source.innerHTML // no type, display raw HTML as text
					}
				}) // sourceObserver
			} // constructor()
			
			connectedCallback() {
				var findClosest = (parentElem, selector) => {
					// find the closest relative matching selector
					var closest = null
					if (parentElem) {
						closest = parentElem.querySelector(selector)
						if (!closest) closest = findClosest(parentElem.parentElement, selector)
					}
					return closest
				} // findClosest(parentElem, selector)
				if (!this.id) this.id = 'sink' + Math.round(Math.random()*1000000)  // make sure element has an id
				var sourceSelector = this.getAttribute('data-source')
				var type = this.getAttribute('data-type')
				if (sourceSelector) {
					var source = findClosest(this, sourceSelector.trim())
					if (source) {
						this.sourceObserver.source = source
						this.sourceObserver.sink = this
						this.sourceObserver.type = type ? type.trim() : null
						this.sourceObserver.observe(source, {subtree: true, childList:true, characterData: true})
					} else {
						var errorInfo = "No source found in &lt;myword-sink> using selector " + sourceSelector
						console.error(errorInfo)
						this.innerHTML = ["<pre><mark style='color:blue'>\n*** Error *** ", errorInfo, "\n</mark></pre>"].join('')
					}
				}
			} // connectedCallback()
			
			disconnectedCallback() {
				this.sourceObserver.disconnect()
			} // disconnectedCallback()
			
		} // MyWordSink

		if (!customElements.get('myword-sink'))
			customElements.define('myword-sink', MyWordSink)

	}) ()

// This @doc block must appear after the defintions to use them.
@doc
	####	Example code block
	A code (or other) example can be written using the `eg` block label. It wraps the literal content in a `<div class='eg'>` element and applies some simple style rules.
	demo
		eg
			###  A Header

	####	Demo
	The `demo` block notation splits the document in two displaying `myword` source on the right and the rendered version on the left, as used throughout this documentation. For example:
	demo
		demo
			###  A Header

	####	Interactive Demo
	The `demoI` block notation is similar to `demo` except the user can modify the `myword` source on the left side of the document. When the source is in focus, i.e., editable, the background colour changes to light yellow.
	demo
		demoI
			*Modify me!*

	####	Interactive Demo with optional HTML
	The `demoIhtml` block notation further enhances `demoI` to add the generated HTML under the rendered source along with a button under the source to toggle the HTML display. The initial state is HTML hidden.
	demo
		demoIhtml
			*Modify me!*

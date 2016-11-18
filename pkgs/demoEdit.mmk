.demo? = <table class='demo'> demoES

demoES   :: (content) =>
	["<tr>",
	 "<td class='A1'>",
	   "<myword-editable>", markit('text', content), "</myword-editable>",
	 "</td>",
	 "<td class='B1'>",
	   "<myword-sink data-source='.A1' data-transform=myword>", markit('myword', content), "</myword-sink>",
	 "</td>",
	 "</tr>"].join('')
	 

.demo?+ = <table class='demo'> demoEH

demoEH    :: (content) => {
	var html = markit('myword', content);
	return ["<tr>",
		"<td class='A1'>",
		  "<myword-editable>", markit('text', content), "</myword-editable>",
		"</td>",
		"<td class='B1'>",
		  "<myword-sink data-source='.A1' data-transform=myword>", html, "</myword-sink>",
		"</td>",
		"</tr>",
		"<tr>",
		"<td style='vertical-align:top'>",
		  "<button onclick='var toHide = this.parentNode.nextSibling; toHide.hidden = !toHide.hidden'>Toggle HTML Display</button>",
		"</td>",
		"<td class='A3' hidden>",
		  "<myword-sink data-source='.B1>myword-sink'>", markit('text', html), "</myword-sink>",
		"</td>",
		"</tr>"].join('')
	}
	
@css
	myword-editable {display:block}
	myword-editable:focus {outline:none; background:lightyellow}

	table.demo td.A3 {
		overflow:hidden; vertical-align:top;
		padding-left:10pt; padding-right:30pt;
		white-space:pre; font-family:monospace; background:whitesmoke;
	}

@javascript
  (function () {

  // <myword-editable> editable element permitting tab input
  //    uses custom elements v1
  class MyWordEditable extends HTMLElement {
    constructor() { super(); }
    connectedCallback() {
      this.contentEditable = true //; console.log('contentEditable=',this.contentEditable)
      this.addEventListener('keydown', function (event) { // replace tab functionality
        if (event.keyCode == 9 || event.which == 9) {
          document.execCommand('insertText', false, '\t')
          event.preventDefault()
        } else event.stopPropagation()
        return false    // don't lose focus
      })
    } // connectedCallback()
  } // MyWordEditable
  if (!customElements.get('myword-editable'))
    customElements.define('myword-editable', MyWordEditable)


  // <myword-sink> monitor a source for change and transform source.contents to this.contents
  //    uses custom elements v1
  class MyWordSink extends HTMLElement {
      constructor() { super(); }
      connectedCallback() {
        var sourceSelector = this.getAttribute('data-source')
        var transform = this.getAttribute('data-transform')
        if (sourceSelector) {
          var source = findClosest(this, sourceSelector.trim())
          if (source) {
            var sourceObserver = new MutationObserver(function(mutations, observer) {
              if (observer.transform) {
                observer.sink.textContent = observer.source.innerText || observer.source.textContent
                window.x_markup.transformElement(observer.transform, observer.sink)  // x-markup API function to transform element contents
              } else {
                observer.sink.textContent = observer.source.innerHTML // no transform, display raw HTML as text
              }
            })
            sourceObserver.source = source
            sourceObserver.sink = this
            sourceObserver.transform = transform ? transform.trim() : null
            sourceObserver.observe(source, {subtree: true, childList:true, characterData: true})
          } else {
            this.innerHTML = errorString("No source found in &lt;myword-sink> using selector " + sourceSelector)
          }
        }
      } // connectedCallback()
    } // MyWordSink
  if (!customElements.get('myword-sink'))
    customElements.define('myword-sink', MyWordSink)


  // Helper functions :

  function findClosest(parentElem, selector) {
    // find the closest relative matching selector
    var closest = null
    if (parentElem) {
      closest = parentElem.querySelector(selector)
      if (!closest) closest = findClosest(parentElem.parentElement, selector)
    }
    return closest
  } // findClosest(parentElem, selector)

  function errorString(errorInfo) {
    console.error(errorInfo)
    return ["<pre><mark style='color:blue'>\n*** Error *** ", errorInfo, "\n</mark></pre>"].join('');
  } // errorString(errorInfo)

  })()
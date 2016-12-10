.demo? = <table class='demo'> demoE

demoE   :: (content) =>
                `<tr>
                    <td class='A1'><myword-editable>${markit('text', content)}</myword-editable></td>
                    <td class='B1'><myword-sink data-source='.A1' data-transform=myword>${markit('myword', content)}</myword-sink></td>
                </tr>`


.demo?+ = <table class='demo'> demoEH

demoEH   :: (content) => (
                (source = content, html = markit('myword', content)) =>
                    `<tr>
                        <td class='A1'><myword-editable>${markit('text', source)}</myword-editable></td>
                        <td class='B1'><myword-sink data-source='.A1' data-transform=myword>${html}</myword-sink></td>
                    </tr>
                    <tr>
                        <td style='vertical-align:top'><button onclick='((toHide) => toHide.hidden = !toHide.hidden) (this.parentElement.nextElementSibling)'>Toggle HTML Display</button></td>
                        <td class='A3' hidden  style='overflow-x:auto'><myword-sink data-source='.B1>myword-sink'>${markit('text', html)}</myword-sink></td>
                    </tr>`
             )()

@css
	myword-editable {display:block}
	myword-editable:focus {outline:none; background:lightyellow}

	table.demo td.A3 {
		overflow:hidden; vertical-align:top;
		padding-left:10pt; padding-right:30pt;
		white-space:pre; font-family:monospace; background:whitesmoke;
	}

@javascript
  ( () => {

  // <myword-editable> editable element permitting tab input
  //    uses custom elements v1
  class MyWordEditable extends HTMLElement {
    constructor() { super(); }
    connectedCallback() {
      this.contentEditable = true //; console.log('contentEditable=',this.contentEditable)
      this.addEventListener('keydown', (event) => { // replace tab functionality
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
      constructor() { super() }
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
        var transform = this.getAttribute('data-transform')
        if (sourceSelector) {
          var source = findClosest(this, sourceSelector.trim())
          if (source) {
            var sourceObserver = new MutationObserver((mutations, observer) => {
              if (observer.transform) {
                observer.sink.textContent = observer.source.innerText || observer.source.textContent
                window.postMessage({transform: observer.transform, selector: this.tagName.toLowerCase()+'#'+this.id}, '*')
              } else {
                observer.sink.textContent = observer.source.innerHTML // no transform, display raw HTML as text
              }
            })
            sourceObserver.source = source
            sourceObserver.sink = this
            sourceObserver.transform = transform ? transform.trim() : null
            sourceObserver.observe(source, {subtree: true, childList:true, characterData: true})
          } else {
            var errorInfo = "No source found in &lt;myword-sink> using selector " + sourceSelector
            console.error(errorInfo)
            this.innerHTML = ["<pre><mark style='color:blue'>\n*** Error *** ", errorInfo, "\n</mark></pre>"].join('')
          }
        }
      } // connectedCallback()

  } // MyWordSink

  if (!customElements.get('myword-sink'))
    customElements.define('myword-sink', MyWordSink)

  })()
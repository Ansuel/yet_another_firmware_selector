
var current_model = {};

function $(id) {
  return document.getElementById(id);
}

function show(id) {
  $(id).style.display = 'block';
}

function hide(id) {
  $(id).style.display = 'none';
}

function build_asa_request() {
  if (!current_model || !current_model.id) {
    alert('bad profile');
    return;
  }

  function split(str) {
    return str.match(/[^\s,]+/g) || [];
  }

  function get_model_titles(titles) {
    return titles.map(e => {
      if (e.title) {
        return e.title;
      } else {
        return ((e.vendor || '') + (e.model || '') + (e.variant || '')).trim();
      }
    }).join('/');
  }

  function showStatus(text) {
    show('buildstatus');
    $('buildstatus').innerHTML = text;
    translate();
  }

  function handleError(response) {
    hide('buildspinner');

    response.json()
      .then(mobj => {
        var message = mobj['message'] || '<span class="tr-build-failed"></span>';
        if (mobj.buildlog == true) {
          var url = config.asu_url + '/store/' + mobj.bin_dir + '/buildlog.txt';
          showStatus('<a href="' + url + '">' + message + '</a>');
        } else {
          showStatus(message);
        }
      });
  }

  // hide image view
  updateImages();

  show('buildspinner');
  showStatus('<span class="tr-request-image"></span>');

  var request_data = {
    'profile': current_model.id,
    'packages': split($('packages').value),
    'version': $('versions').value
  }

  fetch(config.asu_url + '/api/build', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(request_data)
  })
  .then(response => {
    switch (response.status) {
      case 200:
        hide('buildspinner');
        showStatus('<span class="tr-build-successful"></span>');

        response.json()
        .then(mobj => {
          var download_url = config.asu_url + '/store/' + mobj.bin_dir;
          updateImages(
            mobj.version_number,
            mobj.version_commit,
            mobj.build_at,
            get_model_titles(mobj.titles),
            download_url, mobj, true
          );
        });
        break;
      case 202:
        showStatus('<span class="tr-check-again"></span>');
        setTimeout(_ => { build_asa_request() }, 5000);
        break;
      case 400: // bad request
      case 422: // bad package
      case 500: // build failed
        handleError(response);
        break;
    }
  })
  .catch(err => {
    hide('buildspinner');
    showStatus(err);
  })
}

function setupSelectList(select, items, onselection) {
  for (var i = 0; i < items.length; i += 1) {
    var option = document.createElement('OPTION');
    option.innerHTML = items[i];
    select.appendChild(option);
  }

  select.addEventListener('change', e => {
    onselection(items[select.selectedIndex]);
  });

  if (select.selectedIndex >= 0) {
    onselection(items[select.selectedIndex]);
  }
}

// Change the translation of the entire document
function translate() {
  var mapping = translations[config.language];
  for (var tr in mapping) {
    Array.from(document.getElementsByClassName(tr))
      .forEach(e => { e.innerText = mapping[tr]; })
  }
}

function setupAutocompleteList(input, items, onselection) {
  // the setupAutocompleteList function takes two arguments,
  // the text field element and an array of possible autocompleted values:
  var currentFocus = -1;

  // sort numbers and other characters separately
  var collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

  items.sort(collator.compare);

  // execute a function when someone writes in the text field:
  input.oninput = function(e) {
    // clear images
    updateImages();

    var value = this.value;
    // close any already open lists of autocompleted values
    closeAllLists();

    if (!value) {
      return false;
    }

    // create a DIV element that will contain the items (values):
    var list = document.createElement('DIV');
    list.setAttribute('id', this.id + '-autocomplete-list');
    list.setAttribute('class', 'autocomplete-items');
    // append the DIV element as a child of the autocomplete container:
    this.parentNode.appendChild(list);

    // for each item in the array...
    var c = 0;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];

      // match
      var j = item.toUpperCase().indexOf(value.toUpperCase());
      if (j < 0) {
        continue;
      }

      c += 1;
      if (c >= 15) {
        var div = document.createElement('DIV');
        div.innerHTML = '...';
        list.appendChild(div);
        break;
      } else {
        var div = document.createElement('DIV');
        // make the matching letters bold:
        div.innerHTML = item.substr(0, j)
          + '<strong>' + item.substr(j, value.length) + '</strong>'
          + item.substr(j + value.length)
          + '<input type="hidden" value="' + item + '">';

        div.addEventListener('click', function(e) {
          // set text field to selected value
          input.value = this.getElementsByTagName('input')[0].value;
          // close the list of autocompleted values,
          // (or any other open lists of autocompleted values:
          closeAllLists();
          // callback
          onselection(input.value);
        });

        list.appendChild(div);
      }
    }
  };

  input.onkeydown = function(e) {
      var x = document.getElementById(this.id + '-autocomplete-list');
      if (x) x = x.getElementsByTagName('div');
      if (e.keyCode == 40) {
        // key down
        currentFocus += 1;
        // and and make the current item more visible:
        setActive(x);
      } else if (e.keyCode == 38) {
        // key up
        currentFocus -= 1;
        // and and make the current item more visible:
        setActive(x);
      } else if (e.keyCode == 13) {
        // If the ENTER key is pressed, prevent the form from being submitted,
        e.preventDefault();
        if (currentFocus > -1) {
          // and simulate a click on the 'active' item:
          if (x) x[currentFocus].click();
        }
      }
  };

  input.onfocus = function() {
    onselection(input.value);
  }

  function setActive(x) {
    // a function to classify an item as 'active':
    if (!x) return false;
    // start by removing the 'active' class on all items:
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove('autocomplete-active');
    }
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    // add class 'autocomplete-active':
    x[currentFocus].classList.add('autocomplete-active');
  }

  function closeAllLists(elmnt) {
    // close all autocomplete lists in the document,
    // except the one passed as an argument:
    var x = document.getElementsByClassName('autocomplete-items');
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != input) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }

  // execute a function when someone clicks in the document:
  document.addEventListener('click', e => {
      closeAllLists(e.target);
  });
}

function updateImages(version, code, date, model, url, mobj, is_custom) {
  // add download button for image
  function addLink(type, file) {
    var a = document.createElement('A');
    a.classList.add('download-link');
    a.href = url
      .replace('{target}', mobj.target)
      .replace('{version}', version)
      + '/' + file;
    var span = document.createElement('SPAN');
    span.appendChild(document.createTextNode(''));
    a.appendChild(span);
    a.appendChild(document.createTextNode(type.toUpperCase()));

    if (config.showHelp) {
      a.onmouseover = function() {
        // hide all help texts
        Array.from(document.getElementsByClassName('download-help'))
          .forEach(e => e.style.display = 'none');
        var lc = type.toLowerCase();
        if (lc.includes('sysupgrade')) {
          show('sysupgrade-help');
        } else if (lc.includes('factory') || lc == 'trx' || lc == 'chk') {
          show('factory-help');
        } else if (lc.includes('kernel') || lc.includes('zimage') || lc.includes('uimage')) {
          show('kernel-help');
        } else if (lc.includes('root')) {
          show('rootfs-help');
        } else if (lc.includes('sdcard')) {
          show('sdcard-help');
        } else if (lc.includes('tftp')) {
          show('tftp-help');
        } else {
          show('other-help');
        }
      };
    }

    $('download-links').appendChild(a);
  }

  function switchClass(id, from_class, to_class) {
    $(id).classList.remove(from_class);
    $(id).classList.add(to_class);
  }

  // remove all download links
  Array.from(document.getElementsByClassName('download-link'))
    .forEach(e => e.remove());

  // hide all help texts
  Array.from(document.getElementsByClassName('download-help'))
    .forEach(e => e.style.display = 'none');

  if (version && code && date && model && url && mobj) {
    var target = mobj.target;
    var images = mobj.images;

    // change between "version" and "custom" title
    if (is_custom) {
      switchClass('images-title', 'tr-version-build', 'tr-custom-build');
      switchClass('downloads-title', 'tr-version-downloads', 'tr-custom-downloads');
    } else {
      switchClass('images-title', 'tr-custom-build', 'tr-version-build');
      switchClass('downloads-title', 'tr-custom-downloads', 'tr-version-downloads');
    }
    // update title translation
    translate();

    // fill out build info
    $('image-model').innerText = model;
    $('image-target').innerText = target;
    $('image-version').innerText = version;
    $('image-code').innerText = code;
    $('image-date').innerText = date;

    images.sort((a, b) => a.name.localeCompare(b.name));

    for (var i in images) {
      addLink(images[i].type, images[i].name);
    }

    show('images');
  } else {
    hide('images');
  }
}

setupSelectList($('versions'), Object.keys(config.versions), version => {
  fetch(config.versions[version]).then(data => {
    data.json().then(obj => {
      setupAutocompleteList($('models'), Object.keys(obj['models']), model => {
        if (model in obj['models']) {
          var url = obj.url;
          var code = obj.version_code;
          var date = obj.build_data || 'unknown';
          var mobj = obj['models'][model];
          updateImages(version, code, date, model, url, mobj, false);
          current_model = mobj;
        } else {
          updateImages();
          current_model = {};
        }
      });

      // trigger model update when selected version changes
      $('models').onfocus();
    });
  });
});

if (config.asu_url) {
  show('custom');
}

// hide fields
updateImages();

var user_lang = (navigator.language || navigator.userLanguage).split('-')[0];
if (user_lang in translations) {
  config.language = user_lang;
  $('language-selection').value = user_lang;
}

translate();

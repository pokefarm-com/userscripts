// ==UserScript==
// @name         Nice history
// @match        https://pokefarm.com/*
// @icon         https://pokefarm.com/favicon.ico
// @grant        none
// ==/UserScript==

/*
Author: Mirzam
Keeps track of Nices recieved, so you can easily see who sent them and when!
Nices are ONLY stored locally per device, since the main intent is to be able to view a missed nice.
Report bugs and issues in my main code sharing thread: https://pfq.link/~-HvB

For testing: Manually generate a test nice
Test nices cannot be dismissed normally, but should be detected by the script

username = 'USERNAME';
testNice = document.createElement('div');
testNice.className = 'nice_toast';
testNice.innerHTML = '<div class="nice_star1"></div><div class="nice_star2"></div><div class="nice_star3"></div><a href="#" class="nice_close"></a>'+username+'<br>gave you a Nice!';
document.body.append(testNice);

*/

(function() {
  let userID = null;
  let recentNices = [];

  // You should always call this instead of accessing userID directly
  const getUserID = () => {
    // Detect the current user to set cookie for
    if(!userID) {
      if(document.getElementById('core')) {
        userID = document.getElementById('core').attributes['data-user'].value;
        console.log('Nice watcher detected user: '+userID);
      }
      else {
        console.error('Nice watcher failed to detect user');
      }
    }
    return userID;
  }

  const niceWatch = () => {
    // Detect if a nice has happened
    let niceEls = document.querySelectorAll('body > .nice_toast');
    if(niceEls) {
      niceEls.forEach(niceEl => {
          // don't detect nices in the display window
          let nice = niceEl.innerHTML;
          console.warn('Nice detected!');
          console.log(nice);
          storeNice(nice);
      });
    }
  }

  const storeNice = (nice) => {
    if(!getUserID()) {
      console.error('Failed to store nice: user ID not detected');
      return;
    }

    // Prepare nice for storage
    let userName = '<UNKNOWN>';
    try {
      userName = nice.substr(nice.indexOf('</a>')+4,nice.indexOf('<br>')-nice.indexOf('</a')-4);
    } catch(err) {
      console.error('Failed to parse nice sender');
    }
    if(recentNices.indexOf(userName)>=0) {
      console.log('Skipping repeat nice entry: '+userName);
      return;
    }
    // Attempt to build the URL-friendly name for link purposes
    let normalizedName = '';
    try {
      normalizedName = userName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      normalizedName = normalizedName.replace(' ','_');
      normalizedName = normalizedName.replace('.',':');
    } catch(err) {
      console.warn('Failed to normalize username: '+userName);
    }
    let newNice = {
      'user': userName,
      'profile': normalizedName,
      'date': new Date().getTime()
      //,'content': nice  // for testing only, increases cookie size
    };

    // Append to old nices and save
    let niceObjects = getStoredNices();
    niceObjects.push(newNice);
    recentNices.push(userName);
    localStorage.setItem(getUserID()+'.NiceWatcher', JSON.stringify(niceObjects));
  }

  const getStoredNices = () => {
    let niceObjects = [];
    let existingNices = localStorage.getItem(getUserID()+'.NiceWatcher');
    if(existingNices) {
      try {
        niceObjects = JSON.parse(existingNices);
      } catch(err) {
        console.error('Failed to decode existing nice data: '+existingNices);
        console.error(err);
      }
    }
    return niceObjects;
  }

  const addNiceUI = () => {
    let niceCount = document.getElementById('nicecount').parentElement;
    let niceButton = document.createElement('button');
    niceButton.innerText = '🕒';
    niceButton.style = 'margin-left:0.5em';
    niceButton.onclick = openNiceUI;
    niceCount.append(niceButton);
  }

  const openNiceUI = () => {
    // create modal and open
    let niceWindow = document.createElement('div');
    niceWindow.className = 'dialog';
    let dialogContents = '<div><div><div><h3>Nice History</h3><div style="margin:0.5em;">'
      +'<div>These are nices that have been detected on this device while running the nice watcher script.</div>'
      +'<div><input type="checkbox" id="nice-timezone"><label for="nice-timezone"> Use local timezone</label></div>'
      + '<div id="nice-watcher-contents" style="margin-bottom: 1em; display: flex; flex-wrap: wrap;"></div>'
      + '<button id="nice-watcher-clear" type="button" style="float: left;">Clear</button>'
      + '<button id="nice-watcher-close" type="button" style="float: right;">Close</button>'
      + '</div></div></div></div>';
    niceWindow.innerHTML = dialogContents;
    document.body.append(niceWindow);
    document.getElementById('core').classList.add('scrolllock');
    // add close & clear functions
    document.getElementById('nice-watcher-close').onclick = function() { closeNiceUI(niceWindow); }
    document.getElementById('nice-watcher-clear').onclick = clearNiceHistory;
    // detect timezone setting
    let timezoneSetting = localStorage.getItem(getUserID()+'.NiceWatcherTZ');
    let timezoneCheckbox = document.getElementById('nice-timezone');
    if(timezoneSetting && timezoneSetting=='checked') {
      timezoneCheckbox.checked = true;
    }
    timezoneCheckbox.onchange = changeTZSetting;

    writeNices(timezoneCheckbox.checked);
  }

  const writeNices = (useLocalTime) => {
    let niceContainer = document.getElementById('nice-watcher-contents');
    let niceObjects = getStoredNices();
    if(niceObjects.length<1) {
      niceContainer.innerHTML = '<p>(No nices detected yet.)</p>';
    }
    else {
      niceContainer.innerHTML = '';
      niceObjects.forEach(niceObj => {
        let printNice = document.createElement('div');
        printNice.className = 'nice_toast';
        printNice.style = 'border: 1px solid; position: unset !important;';
        let dateString = 'UNKNOWN_TIME';
        try {
          let dateOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
          };
          if(useLocalTime) {
            dateString = new Intl.DateTimeFormat(undefined, dateOptions).format(new Date(niceObj.date));
          }
          else {
            dateOptions.timeZone = 'UTC';
            dateOptions.hour12 = false;
            dateString = new Intl.DateTimeFormat('en-UK', dateOptions).format(new Date(niceObj.date));
          }
        } catch(err) {
          console.error('Failed to read and convert stored nice time');
          console.error(err);
        }
        let showName = niceObj.user;
        if(niceObj.profile) {
          showName = '<a href="https://pokefarm.com/user/'+niceObj.profile+'">'+niceObj.user+'</a>';
        }
        printNice.innerHTML = '<div class="nice_star1"></div><div class="nice_star2"></div><div class="nice_star3"></div>'
          +showName+'<br>gave you a Nice!<div>@ '+dateString+'</div>';
        niceContainer.append(printNice);
      });
    }
  }

  const closeNiceUI = (niceWindow) => {
    niceWindow.remove();
    document.getElementById('core').classList.remove('scrolllock');
  }

  const clearNiceHistory = () => {
    if (window.confirm('Really clear the nice history?')) {
      localStorage.removeItem(getUserID()+'.NiceWatcher');
      document.getElementById('nice-watcher-contents').innerHTML = '<p>(No nices detected yet.)</p>';
    }
  }

  const changeTZSetting = (event) => {
    console.log('Nice TZ setting changed');
    writeNices(event.target.checked);
    if(event.target.checked) {
      localStorage.setItem(getUserID()+'.NiceWatcherTZ','checked');
    }
    else {
      localStorage.setItem(getUserID()+'.NiceWatcherTZ','unchecked');
    }
  }

  const niceMO = new MutationObserver(niceWatch);
  niceMO.observe(document.body, { childList: true, subtree: false });
  addNiceUI();
}
)();

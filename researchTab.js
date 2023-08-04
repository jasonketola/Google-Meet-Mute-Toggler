var muted = false;
var joined_status = true;
var divs = document.getElementsByTagName("*");

// Check if not yet joined

for (let elem of divs) {
  if ((elem.innerHTML.indexOf('Join now') != -1) || (elem.innerHTML.indexOf('Rejoin') != -1)) {
    joined_status = false;
  } else if (elem.matches('div[data-tooltip~="microphone"]')) {
    let re = /Turn on/;
    if (elem.getAttribute('data-tooltip').match(re)) {
      muted = true;

    }
  };

};

[joined_status, muted];


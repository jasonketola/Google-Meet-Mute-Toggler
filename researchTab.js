var muted = false;
var joined_status = true;
var divs = document.getElementsByTagName("*");
var re = /Turn on/;

for (let elem of divs) {
  // Check if not yet joined
  if ((elem.innerHTML.indexOf('Join now') != -1) || (elem.innerHTML.indexOf('Rejoin') != -1)) {
    joined_status= false;
  // aria-label is "new google meet" style
  } else if (elem.matches('button[aria-label~="microphone"]')) {
    if (elem.getAttribute('aria-label').match(re)) {
      muted = true;
    }
  // data-tooltip is "old" google meet style
  } else if (elem.matches('div[data-tooltip~="microphone"]')) {
    if (elem.getAttribute('data-tooltip').match(re)) {
      muted = true;
    }
  }
};
    
  
[joined_status, muted];


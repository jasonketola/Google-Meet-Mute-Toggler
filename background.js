
// Sets the icon color appropriately
function updateIcon(statuses) {
	var joined_status = statuses[0][0];
	var muted = statuses[0][1];


	if (!joined_status) {
		// Set icon to gray if not in an active Meet
		chrome.browserAction.setIcon({path:"M_gray128.png"});
	} else if (muted) {
		// Set icon to red if in an active Meet and muted
		chrome.browserAction.setIcon({path:"M_red128.png"});
	} else {
		// Otherwise set icon to green, meaning unmuted in an active meet
		chrome.browserAction.setIcon({path:"M_green128.png"});
	}
}

// Global variables. Bad practice I know. Some of these should be booleans.

var x = -1; // Keeps track of id of which tab to interact with
var only_base = 0; // If only meet.google.com is open (doesn't include meet.google.com/xxx-xxxx-xxx)
var base = 0; // If meet.google.com is open
var alerts = 0; // If an alert has been triggered related to having too many meet windows open
var count = 0; // Number of meet.google.com/xxx-xxxx-xxx windows open


// Checks which tabs are open, which should be interacted with, and alerts if too many meets are open
function assessTabs (tab) {
  chrome.tabs.query({url: "https://meet.google.com/*"}, function(tabs) {

  	// Reset global variable values
  	base = 0;
  	only_base = 0;
  	x = -1;
  	count = 0;

  	// Checks if meet.google.com is open and how many xxx-xxxx-xxx meets
  	tabs.forEach( function (item, index) {
  		if (item.url == 'https://meet.google.com/') {
  			base = 1;
  		} else {
  			count++;
  		};
  	});

  	// Checks if only meet.google.com is open
  	if ((base == 1) && (count == 0)) {
  		only_base = 1;
  	};

  	// If xxx-xxxx-xxx meets are open set alarm, so that they can be monitored
  	if (count > 0) {
  		chrome.alarms.create("3sec", {
  			delayInMinutes: 0.05,
  			periodInMinutes: 0.05
		});
  	}

  	// If xxx-xxxx-xxx meets are all closed, stop the alarm
  	if (count == 0) {
  		chrome.alarms.clear("3sec");
  	}

  	// If only one meet is open reset alert
  	if (count == 1) {
  		alerts = 0;
  		chrome.browserAction.setBadgeText({text: ''});
  	}

  	// If an alert hasn't been triggered and if more than one xxx-xxxx-xxx meet is open, alert to close some
  	tabs.forEach( function (item, index) {
  		if (alerts == 0) {
	  		if (count > 1) {
	  			alert('You have ' + count + ' Google Meets open. Close all but one.');
	  			alerts = 1;
	  			chrome.browserAction.setBadgeText({text: 'Err'});
	  		} else {
	  			// If only one meet is open and no alerts have been triggered, set x with the id of the tab to interact with
	  			x = index;
	  		}
  	};
  	
  		
  	
	});


  });
};

// Inject keypress for toggling mute into appropriate tab
function sendKeypress (tab) {
	chrome.tabs.query({url: "https://meet.google.com/*"}, function(tabs) {
		if (x != -1) {
			chrome.tabs.executeScript(tabs[x].id, {
				file: 'sendKeypress.js'
			});
		}
	});
}

// Research meet is active and mute status
function researchTab (tab) {
  chrome.tabs.query({url: "https://meet.google.com/*"}, function(tabs) {
  	if ( count == 1 ) {
	    chrome.tabs.executeScript(tabs[x].id, {
			file: 'researchTab.js'
		}, updateIcon);
	};


  });
};


// Functions to run when icon is clicked.
chrome.browserAction.onClicked.addListener( function (tab) {
	assessTabs();
	sendKeypress();
	researchTab();
	});


// When a meet.google.com/* window is opened (or closed) run functions
chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
	if (changeInfo.status == 'complete' || changeInfo.discarded) {
		assessTabs(tab);
		researchTab(tab);
	}
});



// Run functions when alarm goes off
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === "3sec") {
    assessTabs();
	researchTab();
  }
});


// Run functions on load
assessTabs();
researchTab();



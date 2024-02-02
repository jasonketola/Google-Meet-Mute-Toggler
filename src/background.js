const MEET_URL = 'https://meet.google.com/'
const MEET_URL_AST = 'https://meet.google.com/*'

const TEAMS_URL = 'https://teams.microsoft.com/v2/'
const TEAMS_URL_AST = 'https://teams.microsoft.com/v2/*'

const ICON_GRAY48 = chrome.runtime.getURL('icons/M_gray48.png')
const ICON_GRAY128 = chrome.runtime.getURL('icons/M_gray128.png')
const ICON_RED128 = chrome.runtime.getURL('icons/M_red128.png')
const ICON_GREEN128 = chrome.runtime.getURL('icons/M_green128.png')

// Sets the icon color appropriately
const updateIcon = (statuses) => {
  const muted = statuses[0].result[0]
  const joined_status = statuses[0].result[1]

  // Set icon to gray if not in an active Meet
  // Set icon to red if in an active Meet and muted
  // Otherwise set icon to green, meaning unmuted in an active meet
  const icon = (!joined_status) ? ICON_GRAY128 : (muted) ? ICON_RED128 : ICON_GREEN128
  chrome.action.setIcon({ path: icon })
}

// Global variables. Bad practice I know.

let meetTabId = -1 // Keeps track of id of which tab to interact with
let meetOnlyTab = false // If only meet.google.com is open (doesn't include meet.google.com/xxx-xxxx-xxx)
let meetIsOpen = false // If meet.google.com is open
let meetAlerts = false // If an alert has been triggered related to having too many meet windows open
let meetCount = 0 // Number of meet.google.com/xxx-xxxx-xxx windows open

// Checks which tabs are open, which should be interacted with, and alerts if too many meets are open
const assessMeetTabs = () => {
  chrome.tabs.query({ url: MEET_URL_AST }, (tabs) => {
    const checkMeetingTabsResponse = checkMeetingTabs(tabs, MEET_URL, 'Google Meets')
    meetIsOpen = checkMeetingTabsResponse.isOpen
    meetTabId = checkMeetingTabsResponse.tabId
    meetCount = checkMeetingTabsResponse.tabCount
    meetAlerts = checkMeetingTabsResponse.alerts
    meetOnlyTab = checkMeetingTabsResponse.onlyTab
  })
}

let teamsTabId = -1
let teamsOnlyTab = false
let teamsIsOpen = false
let teamsAlerts = false
let teamsCount = 0

const assessTeamsTabs = () => {
  chrome.tabs.query({ url: TEAMS_URL_AST }, (tabs) => {
    const checkMeetingTabsResponse = checkMeetingTabs(tabs, TEAMS_URL, 'Microsoft Teams')
    teamsIsOpen = checkMeetingTabsResponse.isOpen
    teamsTabId = checkMeetingTabsResponse.tabId
    teamsCount = checkMeetingTabsResponse.tabCount
    teamsAlerts = checkMeetingTabsResponse.alerts
    teamsOnlyTab = checkMeetingTabsResponse.onlyTab
  })
}

// Inject keypress for toggling mute into appropriate tab
const sendKeypress = (tabId, url, filePath) => {
  chrome.tabs.query({ url }, (tabs) => {
    if (tabId != -1) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[tabId].id },
        files: [filePath],
      })
    }
  })
}
const sendKeypressMeet = (tabId) => sendKeypress(tabId, MEET_URL_AST, 'src/sendKeypressMeet.js')
const sendKeypressTeams = (tabId) => sendKeypress(tabId, TEAMS_URL_AST, 'src/sendKeypressTeams.js')

// Research meet is active and mute status
const researchTab = (url, tabCount, tabId, func) => {
  chrome.tabs.query({ url }, (tabs) => {
    if (tabCount == 1) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[tabId].id },
          func,
        },
        updateIcon,
      )
    }
  })
}

const researchTabMeet = (url, tabCount, tabId) => researchTab(url, tabCount, tabId, checkMuteMeet)
const researchTabTeams = (url, tabCount, tabId) => researchTab(url, tabCount, tabId, checkMuteTeams)


const checkMuteMeet = () => {
  let muted = false
  let joined_status = true
  for (let elem of document.getElementsByTagName('*')) {
    if ((elem.innerHTML.indexOf('Join now') != -1) || (elem.innerHTML.indexOf('Rejoin') != -1)) {
      joined_status = false
    } else if (elem.matches('[aria-label~="microphone"]') && ['DIV', 'BUTTON'].includes(elem.nodeName)) {
      // FIXME: 想定外の要素まで取れているためisMutedが取れなかったらスキップする
      if (elem.dataset?.isMuted === undefined) continue
      muted = JSON.parse(elem.dataset?.isMuted)
    }
  }
  return [muted, joined_status]
}

const checkMuteTeams = () => {
  let muted = false
  let joined_status = true
  const microphoneButton = document.getElementById('microphone-button')
  // TODO: もう少しいい要素があるはず
  muted = microphoneButton.dataset.trackModuleNameNew == 'unMute'
  return [muted, joined_status]
}

const checkMeetingTabs = (tabs, url, serviceName = 'Meeting Service') => {
  const response = {
    isOpen: false,
    tabId: -1,
    tabCount: 0,
    alerts: false,
    onlyTab: false
  }

  // Checks if meeting tabs is open and how many
  tabs.forEach((item, index) => {
    if (item.url == url) {
      response.isOpen = true
    } else {
      response.tabCount++
    }
  })

  // Checks if only tab is open
  const onlyTab = response.isOpen && response.tabCount == 0

  // If tabs are open set alarm, so that they can be monitored
  if (response.tabCount > 0) {
    // https://developer.chrome.com/docs/extensions/reference/alarms/#method-create
    // To help you debug your app or extension, when you've loaded it unpacked, there's no limit to how often the alarm can fire.
    chrome.alarms.create('1min', {
      periodInMinutes: 0.05,
    })
  }

  // If tabs are all closed, stop the alarm and reset icon and badge
  if (response.tabCount === 0) {
    chrome.alarms.clear('1min')
    chrome.action.setIcon({ path: ICON_GRAY128 })
    chrome.action.setBadgeText({ text: '' })
  }

  // If only one tab is open reset alert
  if (response.tabCount === 1) {
    response.alerts = false
    chrome.action.setBadgeText({ text: '' })
  }

  // If an alert hasn't been triggered and if more than one tabs is open, alert to close some
  tabs.forEach((item, index) => {
    if (!response.alerts) {
      if (response.tabCount > 1) {
        chrome.notifications.create(
          '',
          {
            type: 'basic',
            title: '',
            message: `You have ${tabCount} ${serviceName} open. Close all but one.`,
            iconUrl: ICON_GRAY128,
          },
        )
        response.alerts = true
        chrome.action.setBadgeText({ text: 'Err' })
      } else {
        // If only one meet is open and no alerts have been triggered, set x with the id of the tab to interact with
        response.tabId = index
      }
    }
  })
  return response
}

const run = (isKeypress) => {
  assessMeetTabs()
  assessTeamsTabs()

  // タブが開いてなければ何もしない
  if (meetCount + teamsCount <= 0) {
    return
  }

  // meetのみの場合
  if (meetCount > 0 && teamsCount <= 0) {
    if (isKeypress) sendKeypressMeet(meetTabId)
    setTimeout(() => researchTabMeet(MEET_URL_AST, meetCount, meetTabId), 50)
    return
  }

  // teamsのみの場合
  if (meetCount <= 0 && teamsCount > 0) {
    // FIXME: マイクアイコンのチェックがMeetの設定のままのため、正常に動かない
    if (isKeypress) sendKeypressTeams(teamsTabId)
    setTimeout(() => researchTabTeams(TEAMS_URL_AST, teamsCount, teamsTabId), 50)
    return
  }

  chrome.notifications.create(
    '',
    {
      type: 'basic',
      title: '',
      message: `You have ${meetCount + teamsCount} Meet & Teams open. Close all but one.`,
      iconUrl: ICON_GRAY128,
    },
  )
}

// Functions to run when icon is clicked.
chrome.action.onClicked.addListener((tab) => {
  run(true)
})

// When a meet.google.com/* window is opened (or closed) run functions
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status == 'complete' || changeInfo.discarded) {
    run(false)
  }
})

// Run functions when alarm goes off
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === '1min') {
    run(false)
  }
})

// Run functions on load
run(false)

// Reset icon and badge on onload / cleanup in case of crash
addEventListener('beforeunload', () => {
  chrome.action.setIcon({ path: ICON_GRAY128 })
  chrome.action.setBadgeText({ text: '' })
})

// ショートカットキー入力時の処理
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-mute') {
    run(true)
  }
})

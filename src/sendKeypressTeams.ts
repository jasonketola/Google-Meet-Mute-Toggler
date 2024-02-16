// Determine if the OS being used is macOS or something else. If macOS send metakey+d, otherwise send ctrl+d
{
  let OSName = 'other'
  if (navigator.userAgent.indexOf('Mac') != -1) OSName = 'MacOS'

  if (OSName == 'MacOS') {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        metaKey: true, // command
        shiftKey: true, // shift
        keyCode: 77, // 非推奨
        code: 'KeyM'
      })
    )
  } else {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        shiftKey: true, // shift
        keyCode: 77, // 非推奨
        code: 'KeyM'
      })
    )
  }
}

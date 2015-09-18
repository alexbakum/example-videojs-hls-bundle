(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require('videojs-ima');
},{"videojs-ima":3}],2:[function(require,module,exports){
(function (global){

; videojs = global.videojs = require("video.js");
; var __browserify_shim_require__=require;(function browserifyShim(module, define, require) {
/**
 * Basic Ad support plugin for video.js.
 *
 * Common code to support ad integrations.
 */
(function(window, document, vjs, undefined) {
"use strict";

var

  /**
   * Copies properties from one or more objects onto an original.
   */
  extend = function(obj /*, arg1, arg2, ... */) {
    var arg, i, k;
    for (i=1; i<arguments.length; i++) {
      arg = arguments[i];
      for (k in arg) {
        if (arg.hasOwnProperty(k)) {
          obj[k] = arg[k];
        }
      }
    }
    return obj;
  },

  /**
   * Add a handler for multiple listeners to an object that supports addEventListener() or on().
   *
   * @param {object} obj The object to which the handler will be assigned.
   * @param {mixed} events A string, array of strings, or hash of string/callback pairs.
   * @param {function} callback Invoked when specified events occur, if events param is not a hash.
   *
   * @return {object} obj The object passed in.
   */
  on = function(obj, events, handler) {

    var

      type = Object.prototype.toString.call(events),

      register = function(obj, event, handler) {
        if (obj.addEventListener) {
          obj.addEventListener(event, handler);
        } else if (obj.on) {
          obj.on(event, handler);
        } else if (obj.attachEvent) {
          obj.attachEvent('on' + event, handler);
        } else {
          throw new Error('object has no mechanism for adding event listeners');
        }
      },

      i,
      ii;

    switch (type) {
      case '[object String]':
        register(obj, events, handler);
        break;
      case '[object Array]':
        for (i = 0, ii = events.length; i<ii; i++) {
          register(obj, events[i], handler);
        }
        break;
      case '[object Object]':
        for (i in events) {
          if (events.hasOwnProperty(i)) {
            register(obj, i, events[i]);
          }
        }
        break;
      default:
        throw new Error('Unrecognized events parameter type: ' + type);
    }

    return obj;

  },

  /**
   * Runs the callback at the next available opportunity.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/window.setImmediate
   */
  setImmediate = function(callback) {
    return (
      window.setImmediate ||
      window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.setTimeout
    )(callback, 0);
  },

  /**
   * Clears a callback previously registered with `setImmediate`.
   * @param {id} id The identifier of the callback to abort
   */
  clearImmediate = function(id) {
    return (window.clearImmediate ||
            window.cancelAnimationFrame ||
            window.webkitCancelAnimationFrame ||
            window.mozCancelAnimationFrame ||
            window.clearTimeout)(id);
  },

  /**
   * If ads are not playing, pauses the player at the next available
   * opportunity. Has no effect if ads have started. This function is necessary
   * because pausing a video element while processing a `play` event on iOS can
   * cause the video element to continuously toggle between playing and paused
   * states.
   *
   * @param {object} player The video player
   */
  cancelContentPlay = function(player) {
    if (player.ads.cancelPlayTimeout) {
      // another cancellation is already in flight, so do nothing
      return;
    }
    player.ads.cancelPlayTimeout = setImmediate(function() {
      // deregister the cancel timeout so subsequent cancels are scheduled
      player.ads.cancelPlayTimeout = null;

      // pause playback so ads can be handled.
      if (!player.paused()) {
        player.pause();
      }

      // add a contentplayback handler to resume playback when ads finish.
      player.one('contentplayback', function() {
        if (player.paused()) {
          player.play();
        }
      });
    });
  },

  /**
   * Returns an object that captures the portions of player state relevant to
   * video playback. The result of this function can be passed to
   * restorePlayerSnapshot with a player to return the player to the state it
   * was in when this function was invoked.
   * @param {object} player The videojs player object
   */
  getPlayerSnapshot = function(player) {
    var
      tech = player.el().querySelector('.vjs-tech'),
      tracks = player.remoteTextTracks ? player.remoteTextTracks() : [],
      track,
      i,
      suppressedTracks = [],
      snapshot = {
        ended: player.ended(),
        src: player.currentSrc(),
        currentTime: player.currentTime(),
        type: player.currentType()
      };

    if (tech) {
      snapshot.nativePoster = tech.poster;
      snapshot.style = tech.getAttribute('style');
    }

    i = tracks.length;
    while (i--) {
      track = tracks[i];
      suppressedTracks.push({
        track: track,
        mode: track.mode
      });
      track.mode = 'disabled';
    }
    snapshot.suppressedTracks = suppressedTracks;

    return snapshot;
  },

  removeClass = function(element, className) {
    var
      classes = element.className.split(/\s+/),
      i = classes.length,
      newClasses = [];
    while (i--) {
      if (classes[i] !== className) {
        newClasses.push(classes[i]);
      }
    }
    element.className = newClasses.join(' ');
  },

  /**
   * Attempts to modify the specified player so that its state is equivalent to
   * the state of the snapshot.
   * @param {object} snapshot - the player state to apply
   */
  restorePlayerSnapshot = function(player, snapshot) {
    var
      // the playback tech
      tech = player.el().querySelector('.vjs-tech'),

      // the number of remaining attempts to restore the snapshot
      attempts = 20,

      suppressedTracks = snapshot.suppressedTracks,
      trackSnapshot,
      restoreTracks =  function() {
        var i = suppressedTracks.length;
        while (i--) {
          trackSnapshot = suppressedTracks[i];
          trackSnapshot.track.mode = trackSnapshot.mode;
        }
      },

      // finish restoring the playback state
      resume = function() {
        var
          ended = false,
          updateEnded = function() {
            ended = true;
          };
        player.currentTime(snapshot.currentTime);

        // Resume playback if this wasn't a postroll
        if (!snapshot.ended) {
          player.play();
        } else {
          // On iOS 8.1, the "ended" event will not fire if you seek
          // directly to the end of a video. To make that behavior
          // consistent with the standard, fire a synthetic event if
          // "ended" does not fire within 250ms. Note that the ended
          // event should occur whether the browser actually has data
          // available for that position
          // (https://html.spec.whatwg.org/multipage/embedded-content.html#seeking),
          // so it should not be necessary to wait for the seek to
          // indicate completion.
          window.setTimeout(function() {
            if (!ended) {
              player.play();
            }
            player.off('ended', updateEnded);
          }, 250);
          player.on('ended', updateEnded);
        }
      },

      // determine if the video element has loaded enough of the snapshot source
      // to be ready to apply the rest of the state
      tryToResume = function() {
        if (tech.readyState > 1) {
          // some browsers and media aren't "seekable".
          // readyState greater than 1 allows for seeking without exceptions
          return resume();
        }

        if (tech.seekable === undefined) {
          // if the tech doesn't expose the seekable time ranges, try to
          // resume playback immediately
          return resume();
        }

        if (tech.seekable.length > 0) {
          // if some period of the video is seekable, resume playback
          return resume();
        }

        // delay a bit and then check again unless we're out of attempts
        if (attempts--) {
          setTimeout(tryToResume, 50);
        } else {
          (function() {
            try {
              resume();
            } catch(e) {
              videojs.log.warn('Failed to resume the content after an advertisement', e);
            }
          })();
        }
      },

      // whether the video element has been modified since the
      // snapshot was taken
      srcChanged;

    if (snapshot.nativePoster) {
      tech.poster = snapshot.nativePoster;
    }

    if ('style' in snapshot) {
      // overwrite all css style properties to restore state precisely
      tech.setAttribute('style', snapshot.style || '');
    }

    // Determine whether the player needs to be restored to its state
    // before ad playback began. With a custom ad display or burned-in
    // ads, the content player state hasn't been modified and so no
    // restoration is required

    if (player.src()) {
      // the player was in src attribute mode before the ad and the
      // src attribute has not been modified, no restoration is required
      // to resume playback
      srcChanged = player.src() !== snapshot.src;
    } else {
      // the player was configured through source element children
      // and the currentSrc hasn't changed, no restoration is required
      // to resume playback
      srcChanged = player.currentSrc() !== snapshot.src;
    }

    if (srcChanged) {
      // on ios7, fiddling with textTracks too early will cause safari to crash
      player.one('contentloadedmetadata', restoreTracks);

      // if the src changed for ad playback, reset it
      player.src({ src: snapshot.src, type: snapshot.type });
      // safari requires a call to `load` to pick up a changed source
      player.load();
      // and then resume from the snapshots time once the original src has loaded
      player.one('contentcanplay', tryToResume);
    } else if (!player.ended() || !snapshot.ended) {
      // if we didn't change the src, just restore the tracks
      restoreTracks();
      // the src didn't change and this wasn't a postroll
      // just resume playback at the current time.
      player.play();
    }
  },

  /**
   * Remove the poster attribute from the video element tech, if present. When
   * reusing a video element for multiple videos, the poster image will briefly
   * reappear while the new source loads. Removing the attribute ahead of time
   * prevents the poster from showing up between videos.
   * @param {object} player The videojs player object
   */
  removeNativePoster = function(player) {
    var tech = player.el().querySelector('.vjs-tech');
    if (tech) {
      tech.removeAttribute('poster');
    }
  },

  // ---------------------------------------------------------------------------
  // Ad Framework
  // ---------------------------------------------------------------------------

  // default framework settings
  defaults = {
    // maximum amount of time in ms to wait to receive `adsready` from the ad
    // implementation after play has been requested. Ad implementations are
    // expected to load any dynamic libraries and make any requests to determine
    // ad policies for a video during this time.
    timeout: 5000,

    // maximum amount of time in ms to wait for the ad implementation to start
    // linear ad mode after `readyforpreroll` has fired. This is in addition to
    // the standard timeout.
    prerollTimeout: 100,

    // maximum amount of time in ms to wait for the ad implementation to start
    // linear ad mode after `contentended` has fired.
    postrollTimeout: 100,

    // when truthy, instructs the plugin to output additional information about
    // plugin state to the video.js log. On most devices, the video.js log is
    // the same as the developer console.
    debug: false
  },

  adFramework = function(options) {
    var
      player = this,

      // merge options and defaults
      settings = extend({}, defaults, options || {}),

      fsmHandler;

    // prefix all video element events during ad playback
    // if the video element emits ad-related events directly,
    // plugins that aren't ad-aware will break. prefixing allows
    // plugins that wish to handle ad events to do so while
    // avoiding the complexity for common usage
    (function() {
      var
        videoEvents = videojs.Html5.Events,
        i,
        returnTrue = function() { return true; },
        triggerEvent = function(type, event) {
          // pretend we called stopImmediatePropagation because we want the native
          // element events to continue propagating
          event.isImmediatePropagationStopped = returnTrue;
          event.cancelBubble = true;
          event.isPropagationStopped = returnTrue;
          player.trigger({
            type: type + event.type,
            state: player.ads.state,
            originalEvent: event
          });
        },
        redispatch = function(event) {
          if (player.ads.state === 'ad-playback') {
            triggerEvent('ad', event);
          } else if (player.ads.state === 'content-playback' && event.type === 'ended') {
            triggerEvent('content', event);
          } else if (player.ads.state === 'content-resuming') {
            if (player.ads.snapshot) {
              // the video element was recycled for ad playback
              if (player.currentSrc() !== player.ads.snapshot.src) {
                if (event.type === 'loadstart') {
                  return;
                }
                return triggerEvent('content', event);

              // we ended playing postrolls and the video itself
              // the content src is back in place
              } else if (player.ads.snapshot.ended) {
                if ((event.type === 'pause' ||
                    event.type === 'ended')) {
                  // after loading a video, the natural state is to not be started
                  // in this case, it actually has, so, we do it manually
                  player.addClass('vjs-has-started');
                  // let `pause` and `ended` events through, naturally
                  return;
                }
                // prefix all other events in content-resuming with `content`
                return triggerEvent('content', event);
              }
            }
            if (event.type !== 'playing') {
              triggerEvent('content', event);
            }
          }
        };

      //Add video.js specific events
      videoEvents.push('firstplay');
      videoEvents.push('loadedalldata');

      i = videoEvents.length;
      while (i--) {
        player.on(videoEvents[i], redispatch);
      }
      return redispatch;
    })();

    // We now auto-play when an ad gets loaded if we're playing ads in the same video element as the content.
    // The problem is that in IE11, we cannot play in addurationchange but in iOS8, we cannot play from adcanplay.
    // This will allow ad-integrations from needing to do this themselves.
    player.on(['addurationchange', 'adcanplay'], function() {
      var snapshot = player.ads.snapshot;
      if (player.currentSrc() === snapshot.src) {
        return;  // do nothing
      }

      player.play();
    });

    // replace the ad initializer with the ad namespace
    player.ads = {
      state: 'content-set',

      // Call this when an ad response has been recieved and there are
      // linear ads ready to be played.
      startLinearAdMode: function() {
        if (player.ads.state !== 'ad-playback') {
          player.trigger('adstart');
        }
      },

      // Call this when a linear ad pod has finished playing.
      endLinearAdMode: function() {
        if (player.ads.state === 'ad-playback') {
          player.trigger('adend');
        }
      },

      // Call this when an ad response has been recieved but there are no
      // linear ads to be played (i.e. no ads available, or overlays).
      // This has no effect if we are already in a linear ad mode.  Always
      // use endLinearAdMode() to exit from linear ad-playback state.
      skipLinearAdMode: function() {
        if (player.ads.state !== 'ad-playback') {
          player.trigger('adskip');
        }
      }
    };

    fsmHandler = function(event) {
      // Ad Playback State Machine
      var
        fsm = {
          'content-set': {
            events: {
              'adscanceled': function() {
                this.state = 'content-playback';
              },
              'adsready': function() {
                this.state = 'ads-ready';
              },
              'play': function() {
                this.state = 'ads-ready?';
                cancelContentPlay(player);
                // remove the poster so it doesn't flash between videos
                removeNativePoster(player);
              },
              'adserror': function() {
                this.state = 'content-playback';
              },
              'adskip': function() {
                this.state = 'content-playback';
              }
            }
          },
          'ads-ready': {
            events: {
              'play': function() {
                this.state = 'preroll?';
                cancelContentPlay(player);
              },
              'adskip': function() {
                this.state = 'content-playback';
              },
              'adserror': function() {
                this.state = 'content-playback';
              }
            }
          },
          'preroll?': {
            enter: function() {
              // change class to show that we're waiting on ads
              player.el().className += ' vjs-ad-loading';
              // schedule an adtimeout event to fire if we waited too long
              player.ads.timeout = window.setTimeout(function() {
                player.trigger('adtimeout');
              }, settings.prerollTimeout);
              // signal to ad plugin that it's their opportunity to play a preroll
              player.trigger('readyforpreroll');
            },
            leave: function() {
              window.clearTimeout(player.ads.timeout);
              removeClass(player.el(), 'vjs-ad-loading');
            },
            events: {
              'play': function() {
                cancelContentPlay(player);
              },
              'adstart': function() {
                this.state = 'ad-playback';
              },
              'adskip': function() {
                this.state = 'content-playback';
              },
              'adtimeout': function() {
                this.state = 'content-playback';
              },
              'adserror': function() {
                this.state = 'content-playback';
              }
            }
          },
          'ads-ready?': {
            enter: function() {
              player.el().className += ' vjs-ad-loading';
              player.ads.timeout = window.setTimeout(function() {
                player.trigger('adtimeout');
              }, settings.timeout);
            },
            leave: function() {
              window.clearTimeout(player.ads.timeout);
              removeClass(player.el(), 'vjs-ad-loading');
            },
            events: {
              'play': function() {
                cancelContentPlay(player);
              },
              'adscanceled': function() {
                this.state = 'content-playback';
              },
              'adsready': function() {
                this.state = 'preroll?';
              },
              'adskip': function() {
                this.state = 'content-playback';
              },
              'adtimeout': function() {
                this.state = 'content-playback';
              },
              'adserror': function() {
                this.state = 'content-playback';
              }
            }
          },
          'ad-playback': {
            enter: function() {
              // capture current player state snapshot (playing, currentTime, src)
              this.snapshot = getPlayerSnapshot(player);

              // add css to the element to indicate and ad is playing.
              player.el().className += ' vjs-ad-playing';

              // remove the poster so it doesn't flash between ads
              removeNativePoster(player);

              // We no longer need to supress play events once an ad is playing.
              // Clear it if we were.
              if (player.ads.cancelPlayTimeout) {
                clearImmediate(player.ads.cancelPlayTimeout);
                player.ads.cancelPlayTimeout = null;
              }
            },
            leave: function() {
              removeClass(player.el(), 'vjs-ad-playing');
              restorePlayerSnapshot(player, this.snapshot);
              // trigger 'adend' as a consistent notification
              // event that we're exiting ad-playback.
              if (player.ads.triggerevent !== 'adend') {
                player.trigger('adend');
              }
            },
            events: {
              'adend': function() {
                this.state = 'content-resuming';
              },
              'adserror': function() {
                this.state = 'content-resuming';
              }
            }
          },
          'content-resuming': {
            enter: function() {
              if (this.snapshot.ended) {
                window.clearTimeout(player.ads._fireEndedTimeout);
                // in some cases, ads are played in a swf or another video element
                // so we do not get an ended event in this state automatically.
                // If we don't get an ended event we can use, we need to trigger
                // one ourselves or else we won't actually ever end the current video.
                player.ads._fireEndedTimeout = window.setTimeout(function() {
                  player.trigger('ended');
                }, 1000);
              }
            },
            leave: function() {
              window.clearTimeout(player.ads._fireEndedTimeout);
            },
            events: {
              'contentupdate': function() {
                this.state = 'content-set';
              },
              'playing': function() {
                this.state = 'content-playback';
              },
              'ended': function() {
                this.state = 'content-playback';
              }
            }
          },
          'postroll?': {
            enter: function() {
              this.snapshot = getPlayerSnapshot(player);

              player.el().className += ' vjs-ad-loading';

              player.ads.timeout = window.setTimeout(function() {
                player.trigger('adtimeout');
              }, settings.postrollTimeout);
            },
            leave: function() {
              window.clearTimeout(player.ads.timeout);
              removeClass(player.el(), 'vjs-ad-loading');
            },
            events: {
              'adstart': function() {
                this.state = 'ad-playback';
              },
              'adskip': function() {
                this.state = 'content-resuming';
                setImmediate(function() {
                  player.trigger('ended');
                });
              },
              'adtimeout': function() {
                this.state = 'content-resuming';
                setImmediate(function() {
                  player.trigger('ended');
                });
              },
              'adserror': function() {
                this.state = 'content-resuming';
                setImmediate(function() {
                  player.trigger('ended');
                });
              }
            }
          },
          'content-playback': {
            enter: function() {
              // make sure that any cancelPlayTimeout is cleared
              if (player.ads.cancelPlayTimeout) {
                clearImmediate(player.ads.cancelPlayTimeout);
                player.ads.cancelPlayTimeout = null;
              }
              // this will cause content to start if a user initiated
              // 'play' event was canceled earlier.
              player.trigger({
                type: 'contentplayback',
                triggerevent: player.ads.triggerevent
              });
            },
            events: {
              // in the case of a timeout, adsready might come in late.
              'adsready': function() {
                player.trigger('readyforpreroll');
              },
              'adstart': function() {
                this.state = 'ad-playback';
              },
              'contentupdate': function() {
                if (player.paused()) {
                  this.state = 'content-set';
                } else {
                  this.state = 'ads-ready?';
                }
              },
              'contentended': function() {
                this.state = 'postroll?';
              }
            }
          }
        };

      (function(state) {
        var noop = function() {};

        // process the current event with a noop default handler
        ((fsm[state].events || {})[event.type] || noop).apply(player.ads);

        // check whether the state has changed
        if (state !== player.ads.state) {

          // record the event that caused the state transition
          player.ads.triggerevent = event.type;

          // execute leave/enter callbacks if present
          (fsm[state].leave || noop).apply(player.ads);
          (fsm[player.ads.state].enter || noop).apply(player.ads);

          // output debug logging
          if (settings.debug) {
            videojs.log('ads', player.ads.triggerevent + ' triggered: ' + state + ' -> ' + player.ads.state);
          }
        }

      })(player.ads.state);

    };

    // register for the events we're interested in
    on(player, vjs.Html5.Events.concat([
      // events emitted by ad plugin
      'adtimeout',
      'contentupdate',
      'contentplaying',
      'contentended',

      // events emitted by third party ad implementors
      'adsready',
      'adserror',
      'adscanceled',
      'adstart',  // startLinearAdMode()
      'adend',    // endLinearAdMode()
      'adskip'    // skipLinearAdMode()
    ]), fsmHandler);

    // keep track of the current content source
    // if you want to change the src of the video without triggering
    // the ad workflow to restart, you can update this variable before
    // modifying the player's source
    player.ads.contentSrc = player.currentSrc();

    // implement 'contentupdate' event.
    (function(){
      var
        // check if a new src has been set, if so, trigger contentupdate
        checkSrc = function() {
          var src;
          if (player.ads.state !== 'ad-playback') {
            src = player.currentSrc();
            if (src !== player.ads.contentSrc) {
              player.trigger({
                type: 'contentupdate',
                oldValue: player.ads.contentSrc,
                newValue: src
              });
              player.ads.contentSrc = src;
            }
          }
        };
      // loadstart reliably indicates a new src has been set
      player.on(['loadstart'], checkSrc);
      // check immediately in case we missed the loadstart
      setImmediate(checkSrc);
    })();

    // kick off the fsm
    if (!player.paused()) {
      // simulate a play event if we're autoplaying
      fsmHandler({type:'play'});
    }

  };

  // register the ad plugin framework
  vjs.plugin('ads', adFramework);

})(window, document, videojs);
}).call(global, module, undefined, undefined);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"video.js":undefined}],3:[function(require,module,exports){
(function (global){

; videojs = global.videojs = require("video.js");
require("/Users/alexanderbakum/github/example-videojs-hls-bundle/node_modules/videojs-contrib-ads/src/videojs.ads.js");
; var __browserify_shim_require__=require;(function browserifyShim(module, define, require) {
/**
 * Copyright 2014 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * IMA SDK integration plugin for Video.js. For more information see
 * https://www.github.com/googleads/videojs-ima
 */

(function(vjs) {
  'use strict';
  var extend = function(obj) {
    var arg;
    var index;
    var key;
    for (index = 1; index < arguments.length; index++) {
      arg = arguments[index];
      for (key in arg) {
        if (arg.hasOwnProperty(key)) {
          obj[key] = arg[key];
        }
      }
    }
    return obj;
  },

  ima_defaults = {
    debug: false,
    timeout: 5000,
    prerollTimeout: 100
  },

  imaPlugin = function(options, readyCallback) {
    var player = this;

    /**
     * Creates the ad container passed to the IMA SDK.
     * @private
     */
    player.ima.createAdContainer_ = function() {
      // The adContainerDiv is the DOM of the element that will house
      // the ads and ad controls.
      vjsControls = player.getChild('controlBar');
      adContainerDiv =
          vjsControls.el().parentNode.insertBefore(
              document.createElement('div'),
              vjsControls.el());
      adContainerDiv.id = 'ima-ad-container';
      adContainerDiv.style.width = player.width() + 'px';
      adContainerDiv.style.height = player.height() + 'px';
      adContainerDiv.addEventListener(
          'mouseover',
          player.ima.showAdControls_,
          false);
      adContainerDiv.addEventListener(
          'mouseout',
          player.ima.hideAdControls_,
          false);
      player.ima.createControls_();
      adDisplayContainer =
          new google.ima.AdDisplayContainer(adContainerDiv, contentPlayer);
    };

    /**
     * Creates the controls for the ad.
     * @private
     */
    player.ima.createControls_ = function() {
      controlsDiv = document.createElement('div');
      controlsDiv.id = 'ima-controls-div';
      controlsDiv.style.width = '100%';
      countdownDiv = document.createElement('div');
      countdownDiv.id = 'ima-countdown-div';
      countdownDiv.innerHTML = 'Advertisement';
      countdownDiv.style.display = showCountdown ? 'block' : 'none';
      seekBarDiv = document.createElement('div');
      seekBarDiv.id = 'ima-seek-bar-div';
      seekBarDiv.style.width = player.width() + 'px';
      progressDiv = document.createElement('div');
      progressDiv.id = 'ima-progress-div';
      playPauseDiv = document.createElement('div');
      playPauseDiv.id = 'ima-play-pause-div';
      playPauseDiv.className = 'ima-playing';
      playPauseDiv.addEventListener(
          'click',
          player.ima.onAdPlayPauseClick_,
          false);
      muteDiv = document.createElement('div');
      muteDiv.id = 'ima-mute-div';
      muteDiv.className = 'ima-non-muted';
      muteDiv.addEventListener(
          'click',
          player.ima.onAdMuteClick_,
          false);
      sliderDiv = document.createElement('div');
      sliderDiv.id = 'ima-slider-div';
      sliderDiv.addEventListener(
          'mousedown',
          player.ima.onAdVolumeSliderMouseDown_,
          false);
      sliderLevelDiv = document.createElement('div');
      sliderLevelDiv.id = 'ima-slider-level-div';
      fullscreenDiv = document.createElement('div');
      fullscreenDiv.id = 'ima-fullscreen-div';
      fullscreenDiv.className = 'ima-non-fullscreen';
      fullscreenDiv.addEventListener(
          'click',
          player.ima.onAdFullscreenClick_,
          false);
      adContainerDiv.insertBefore(
          controlsDiv,
          adContainerDiv.childNodes[adContainerDiv.childNodes.length]);
      controlsDiv.insertBefore(
          countdownDiv, controlsDiv.childNodes[controlsDiv.childNodes.length]);
      controlsDiv.insertBefore(
          seekBarDiv, controlsDiv.childNodes[controlsDiv.childNodes.length]);
      controlsDiv.insertBefore(
          playPauseDiv, controlsDiv.childNodes[controlsDiv.childNodes.length]);
      controlsDiv.insertBefore(
          muteDiv, controlsDiv.childNodes[controlsDiv.childNodes.length]);
      controlsDiv.insertBefore(
          sliderDiv, controlsDiv.childNodes[controlsDiv.childNodes.length]);
      controlsDiv.insertBefore(
          fullscreenDiv, controlsDiv.childNodes[controlsDiv.childNodes.length]);
      seekBarDiv.insertBefore(
          progressDiv, seekBarDiv.childNodes[controlsDiv.childNodes.length]);
      sliderDiv.insertBefore(
          sliderLevelDiv, sliderDiv.childNodes[sliderDiv.childNodes.length]);
    };

    /**
     * Initializes the AdDisplayContainer. On mobile, this must be done as a
     * result of user action.
     */
    player.ima.initializeAdDisplayContainer = function() {
      adDisplayContainerInitialized = true;
      adDisplayContainer.initialize();
    }

    /**
     * Creates the AdsRequest and request ads through the AdsLoader.
     */
    player.ima.requestAds = function() {
      if (!adDisplayContainerInitialized) {
        adDisplayContainer.initialize();
      }
      var adsRequest = new google.ima.AdsRequest();
      adsRequest.adTagUrl = settings.adTagUrl;

      adsRequest.linearAdSlotWidth = player.width();
      adsRequest.linearAdSlotHeight = player.height();
      adsRequest.nonLinearAdSlotWidth =
          settings.nonLinearWidth || player.width();
      adsRequest.nonLinearAdSlotHeight =
          settings.nonLinearHeight || (player.height() / 3);

      adsLoader.requestAds(adsRequest);
    };

    /**
     * Listener for the ADS_MANAGER_LOADED event. Creates the AdsManager,
     * sets up event listeners, and triggers the 'adsready' event for
     * videojs-ads-contrib.
     * @private
     */
    player.ima.onAdsManagerLoaded_ = function(adsManagerLoadedEvent) {
      adsManager = adsManagerLoadedEvent.getAdsManager(
          contentPlayheadTracker, adsRenderingSettings);

      adsManager.addEventListener(
          google.ima.AdErrorEvent.Type.AD_ERROR,
          player.ima.onAdError_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
          player.ima.onContentPauseRequested_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
          player.ima.onContentResumeRequested_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
          player.ima.onAllAdsCompleted_);

      adsManager.addEventListener(
          google.ima.AdEvent.Type.LOADED,
          player.ima.onAdLoaded_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.STARTED,
          player.ima.onAdStarted_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.CLICK,
          player.ima.onAdPlayPauseClick_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.COMPLETE,
          player.ima.onAdComplete_);
      adsManager.addEventListener(
          google.ima.AdEvent.Type.SKIPPED,
          player.ima.onAdComplete_);

      player.trigger('adsready');
    };

    /**
     * Start ad playback, or content video playback in the absence of a
     * pre-roll.
     */
    player.ima.start = function() {
      try {
        adsManager.init(
            player.width(),
            player.height(),
            google.ima.ViewMode.NORMAL);
        adsManager.setVolume(player.muted() ? 0 : player.volume());
        adsManager.start();
      } catch (adError) {
         player.ima.onAdError_(adError);
      }
    };

    /**
     * Listener for errors fired by the AdsLoader.
     * @param {google.ima.AdErrorEvent} event The error event thrown by the
     *     AdsLoader. See
     *     https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.AdError.Type
     * @private
     */
    player.ima.onAdsLoaderError_ = function(event) {
      window.console.log('AdsLoader error: ' + event.getError());
      if (adsManager) {
        adsManager.destroy();
      }
      player.trigger('adserror');
    };

    /**
     * Listener for errors thrown by the AdsManager.
     * @param {google.ima.AdErrorEvent} adErrorEvent The error event thrown by
     *     the AdsManager.
     * @private
     */
    player.ima.onAdError_ = function(adErrorEvent) {
      window.console.log('Ad error: ' + adErrorEvent.getError());
      adsManager.destroy();
      adContainerDiv.style.display = 'none';
      player.trigger('adserror');
    };

    /**
     * Pauses the content video and displays the ad container so ads can play.
     * @param {google.ima.AdEvent} adEvent The AdEvent thrown by the AdsManager.
     * @private
     */
    player.ima.onContentPauseRequested_ = function(adEvent) {
      adsActive = true;
      adPlaying = true;
      player.off('ended', localContentEndedListener);
      if (adEvent.getAd().getAdPodInfo().getPodIndex() != -1) {
        // Skip this call for post-roll ads
        player.ads.startLinearAdMode();
      }
      adContainerDiv.style.display = 'block';
      controlsDiv.style.display = 'block';
      vjsControls.hide();
      player.pause();
    };

    /**
     * Resumes content video and hides the ad container.
     * @param {google.ima.AdEvent} adEvent The AdEvent thrown by the AdsManager.
     * @private
     */
    player.ima.onContentResumeRequested_ = function(adEvent) {
      adsActive = false;
      adPlaying = false;
      player.on('ended', localContentEndedListener);
      if (currentAd && currentAd.isLinear()) {
        adContainerDiv.style.display = 'none';
      }
      vjsControls.show();
      if (!currentAd) {
        // Something went wrong playing the ad
        player.ads.endLinearAdMode();
      } else if (!contentComplete &&
          // Don't exit linear mode after post-roll or content will auto-replay
          currentAd.getAdPodInfo().getPodIndex() != -1 ) {
        player.ads.endLinearAdMode();
      }
      countdownDiv.innerHTML = '';
    };

    /**
     * Records that ads have completed and calls contentAndAdsEndedListeners
     * if content is also complete.
     * @param {google.ima.AdEvent} adEvent The AdEvent thrown by the AdsManager.
     * @ignore
     */
    player.ima.onAllAdsCompleted_ = function(adEvent) {
      allAdsCompleted = true;
      if (contentComplete == true) {
        for (var index in contentAndAdsEndedListeners) {
          contentAndAdsEndedListeners[index]();
        }
      }
    }

    /**
     * Starts the content video when a non-linear ad is loaded.
     * @param {google.ima.AdEvent} adEvent The AdEvent thrown by the AdsManager.
     * @private
     */
    player.ima.onAdLoaded_ = function(adEvent) {
      if (!adEvent.getAd().isLinear()) {
        player.play();
      }
    };

    /**
     * Starts the interval timer to check the current ad time when an ad starts
     * playing.
     * @param {google.ima.AdEvent} adEvent The AdEvent thrown by the AdsManager.
     * @private
     */
    player.ima.onAdStarted_ = function(adEvent) {
      currentAd = adEvent.getAd();
      if (currentAd.isLinear()) {
        adTrackingTimer = setInterval(
            player.ima.onAdPlayheadTrackerInterval_, 250);
        // Don't bump container when controls are shown
        adContainerDiv.className = '';
      } else {
        // Bump container when controls are shown
        adContainerDiv.className = 'bumpable-ima-ad-container';
      }
    };

    /**
     * Clears the interval timer for current ad time when an ad completes.
     * @param {google.ima.AdEvent} adEvent The AdEvent thrown by the AdsManager.
     * @private
     */
    player.ima.onAdComplete_ = function(adEvent) {
      if (currentAd.isLinear()) {
        clearInterval(adTrackingTimer);
      }
    };

    /**
     * Gets the current time and duration of the ad and calls the method to
     * update the ad UI.
     * @private
     */
    player.ima.onAdPlayheadTrackerInterval_ = function() {
      var remainingTime = adsManager.getRemainingTime();
      var duration =  currentAd.getDuration();
      var currentTime = duration - remainingTime;
      currentTime = currentTime > 0 ? currentTime : 0;
      var isPod = false;
      var adPosition, totalAds;
      if (currentAd.getAdPodInfo()) {
        isPod = true;
        adPosition = currentAd.getAdPodInfo().getAdPosition();
        totalAds = currentAd.getAdPodInfo().getTotalAds();
      }

      // Update countdown timer data
      var remainingMinutes = Math.floor(remainingTime / 60);
      var remainingSeconds = Math.floor(remainingTime % 60);
      if (remainingSeconds.toString().length < 2) {
        remainingSeconds = '0' + remainingSeconds;
      }
      var podCount = ': ';
      if (isPod) {
        podCount = ' (' + adPosition + ' of ' + totalAds + '): ';
      }
      countdownDiv.innerHTML =
          'Advertisement' + podCount +
          remainingMinutes + ':' + remainingSeconds;

      // Update UI
      var playProgressRatio = currentTime / duration;
      var playProgressPercent = playProgressRatio * 100;
      progressDiv.style.width = playProgressPercent + '%';
    };

    /**
     * Hides the ad controls on mouseout.
     * @private
     */
    player.ima.hideAdControls_ = function() {
      playPauseDiv.style.display = 'none';
      muteDiv.style.display = 'none';
      fullscreenDiv.style.display = 'none';
      controlsDiv.style.height = '14px';
    };

    /**
     * Shows ad controls on mouseover.
     * @private
     */
    player.ima.showAdControls_ = function() {
      controlsDiv.style.height = '37px';
      playPauseDiv.style.display = 'block';
      muteDiv.style.display = 'block';
      sliderDiv.style.display = 'block';
      fullscreenDiv.style.display = 'block';
    };

    /**
     * Listener for clicks on the play/pause button during ad playback.
     * @private
     */
    player.ima.onAdPlayPauseClick_ = function() {
      if (adPlaying) {
        playPauseDiv.className = 'ima-paused';
        adsManager.pause();
        adPlaying = false;
      } else {
        playPauseDiv.className = 'ima-playing';
        adsManager.resume();
        adPlaying = true;
      }
    };

    /**
     * Listener for clicks on the mute button during ad playback.
     * @private
     */
    player.ima.onAdMuteClick_ = function() {
      if (adMuted) {
        muteDiv.className = 'ima-non-muted';
        adsManager.setVolume(1);
        // Bubble down to content player
        player.muted(false);
        adMuted = false;
        sliderLevelDiv.style.width = player.volume() * 100 + "%";
      } else {
        muteDiv.className = 'ima-muted';
        adsManager.setVolume(0);
        // Bubble down to content player
        player.muted(true);
        adMuted = true;
        sliderLevelDiv.style.width = "0%";
      }
    };

    /* Listener for mouse down events during ad playback. Used for volume.
     * @private
     */
    player.ima.onAdVolumeSliderMouseDown_ = function() {
       document.addEventListener('mouseup', player.ima.onMouseUp_, false);
       document.addEventListener('mousemove', player.ima.onMouseMove_, false);
    }

    /* Mouse movement listener used for volume slider.
     * @private
     */
    player.ima.onMouseMove_ = function(event) {
      player.ima.setVolumeSlider_(event);
    }

    /* Mouse release listener used for volume slider.
     * @private
     */
    player.ima.onMouseUp_ = function(event) {
      player.ima.setVolumeSlider_(event);
      document.removeEventListener('mousemove', player.ima.onMouseMove_);
      document.removeEventListener('mouseup', player.ima.onMouseUp_);
    }

    /* Utility function so set vvolume and associated UI
     * @private
     */
    player.ima.setVolumeSlider_ = function(event) {
      var percent =
          (event.clientX - sliderDiv.getBoundingClientRect().left) /
              sliderDiv.offsetWidth;
      percent *= 100;
      //Bounds value 0-100 if mouse is outside slider region.
      percent = Math.min(Math.max(percent, 0), 100);
      sliderLevelDiv.style.width = percent + "%";
      player.volume(percent / 100); //0-1
      adsManager.setVolume(percent / 100);
      if (player.volume() == 0) {
        muteDiv.className = 'ima-muted';
        player.muted(true);
        adMuted = true;
      }
      else
      {
        muteDiv.className = 'ima-non-muted';
        player.muted(false);
        adMuted = false;
      }
    }

    /**
     * Listener for clicks on the fullscreen button during ad playback.
     * @private
     */
    player.ima.onAdFullscreenClick_ = function() {
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
    };

    /**
     * Listens for the video.js player to change its fullscreen status. This
     * keeps the fullscreen-ness of the AdContainer in sync with the player.
     * @private
     */
    player.ima.onFullscreenChange_ = function() {
      if (player.isFullscreen()) {
        fullscreenDiv.className = 'ima-fullscreen';
        adContainerDiv.style.width = window.screen.width + 'px';
        adContainerDiv.style.height = window.screen.height + 'px';
        adsManager.resize(
            window.screen.width,
            window.screen.height,
            google.ima.ViewMode.FULLSCREEN);
      } else {
        fullscreenDiv.className = 'ima-non-fullscreen';
        adContainerDiv.style.width = player.width() + 'px';
        adContainerDiv.style.height = player.height() + 'px';
        adsManager.resize(
            player.width(),
            player.height(),
            google.ima.ViewMode.NORMAL);
      }
    };

    /**
     * Listens for the video.js player to change its volume. This keeps the ad
     * volume in sync with the content volume if the volume of the player is
     * changed while content is playing
     * @private
     */
    player.ima.onVolumeChange_ = function() {
      var newVolume = player.muted() ? 0 : player.volume();
      if (adsManager) {
        adsManager.setVolume(newVolume);
      }
    };

    /**
     * Seeks content to 00:00:00. This is used as an event handler for the
     * loadedmetadata event, since seeking is not possible until that event has
     * fired.
     * @private
     */
    player.ima.seekContentToZero_ = function() {
      player.off('loadedmetadata', player.ima.seekContentToZero_);
      player.currentTime(0);
    };

    /**
     * Seeks content to 00:00:00 and starts playback. This is used as an event
     * handler for the loadedmetadata event, since seeking is not possible until
     * that event has fired.
     * @private
     */
    player.ima.playContentFromZero_ = function() {
      player.off('loadedmetadata', player.ima.playContentFromZero_);
      player.currentTime(0);
      player.play();
    };

    /**
     * Destroys the AdsManager, sets it to null, and calls contentComplete to
     * reset correlators. Once this is done it requests ads again to keep the
     * inventory available.
     * @private
     */
    player.ima.resetIMA_ = function() {
      if (adsManager) {
        adsManager.destroy();
        adsManager = null;
      }
      if (adsLoader && !contentComplete) {
        adsLoader.contentComplete();
      }
      contentComplete = false;
      allAdsCompleted = false;
    };

    /**
     * Ads an EventListener to the AdsManager. For a list of available events,
     * see
     * https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.AdEvent.Type
     * @param {google.ima.AdEvent.Type} event The AdEvent.Type for which to listen.
     * @param {function} callback The method to call when the event is fired.
     */
    player.ima.addEventListener = function(event, callback) {
      if (adsManager) {
        adsManager.addEventListener(event, callback);
      }
    };

    /**
     * Returns the instance of the AdsManager.
     * @return {google.ima.AdsManager} The AdsManager being used by the plugin.
     */
    player.ima.getAdsManager = function() {
      return adsManager;
    };

    /**
     * Sets the content of the video player. You should use this method instead
     * of setting the content src directly to ensure the proper ad tag is
     * requested when the video content is loaded.
     * @param {?string} contentSrc The URI for the content to be played. Leave
     *     blank to use the existing content.
     * @param {?string} adTag The ad tag to be requested when the content loads.
     *     Leave blank to use the existing ad tag.
     * @param {?boolean} playOnLoad True to play the content once it has loaded,
     *     false to only load the content but not start playback.
     */
    player.ima.setContent =
        function( contentSrc, adTag, playOnLoad) {
      player.ima.resetIMA_();
      settings.adTagUrl = adTag ? adTag : settings.adTagUrl;
      //only try to pause the player when initialised with a source already
      if (!!player.currentSrc()) {
        player.pause();
      }
      if (contentSrc) {
        player.src(contentSrc);
      }
      if (playOnLoad) {
        player.on('loadedmetadata', player.ima.playContentFromZero_);
      } else {
        player.on('loadedmetadata', player.ima.seekContentToZero_);
      }
    };

    /**
     * Adds a listener for the 'ended' event of the video player. This should be
     * used instead of setting an 'ended' listener directly to ensure that the
     * ima can do proper cleanup of the SDK before other event listeners
     * are called.
     * @param {function} listener The listener to be called when content completes.
     */
    player.ima.addContentEndedListener = function(listener) {
      contentEndedListeners.push(listener);
    };

    /**
     * Adds a listener that will be called when content and all ads have
     * finished playing.
     * @param {function} listener The listener to be called when content and
     *     ads complete.
     */
    player.ima.addContentAndAdsEndedListener = function(listener) {
      contentAndAdsEndedListeners.push(listener);
    }

    /**
     * Pauses the ad.
     */
    player.ima.pauseAd = function() {
      if (adsActive && adPlaying) {
        playPauseDiv.className = 'ima-paused';
        adsManager.pause();
        adPlaying = false;
      }
    };

    /**
     * Resumes the ad.
     */
    player.ima.resumeAd = function() {
      if (adsActive && !adPlaying) {
        playPauseDiv.className = 'ima-playing';
        adsManager.resume();
        adPlaying = true;
      }
    };

    /**
     * Set up intervals to check for seeking and update current video time.
     * @private
     */
    player.ima.setUpPlayerIntervals_ = function() {
      updateTimeIntervalHandle =
          setInterval(player.ima.updateCurrentTime, seekCheckInterval);
      seekCheckIntervalHandle =
          setInterval(player.ima.checkForSeeking_, seekCheckInterval);
    };

    /**
     * Updates the current time of the video
     */
    player.ima.updateCurrentTime = function() {
      if (!contentPlayheadTracker.seeking) {
        contentPlayheadTracker.currentTime = player.currentTime();
      }
    };

    /**
     * Detects when the user is seeking through a video.
     * This is used to prevent mid-rolls from playing while a user is seeking.
     *
     * There *is* a seeking property of the HTML5 video element, but it's not
     * properly implemented on all platforms (e.g. mobile safari), so we have to
     * check ourselves to be sure.
     *
     * @private
     */
    player.ima.checkForSeeking_ = function() {
      var tempCurrentTime = player.currentTime();
      var diff = (tempCurrentTime - contentPlayheadTracker.previousTime) * 1000;
      if (Math.abs(diff) > seekCheckInterval + seekThreshold) {
        contentPlayheadTracker.seeking = true;
      } else {
        contentPlayheadTracker.seeking = false;
      }
      contentPlayheadTracker.previousTime = player.currentTime();
    };

    /**
     * Changes the flag to show or hide the ad countdown timer.
     *
     * @param {boolean} showCountdownIn Show or hide the countdown timer.
     */
    player.ima.setShowCountdown = function(showCountdownIn) {
      showCountdown = showCountdownIn;
      countdownDiv.style.display = showCountdown ? 'block' : 'none';
    };

    /**
     * Current plugin version.
     */
    var VERSION = '0.2.0';

    /**
     * Stores user-provided settings.
     */
    var settings;

    /**
     * Video element playing content.
     */
    var contentPlayer;

    /**
     * Boolean flag to show or hide the ad countdown timer.
     */
    var showCountdown;

    /**
     * Video.js control bar.
     */
    var vjsControls;

    /**
     * Div used as an ad container.
     */
    var adContainerDiv;

    /**
     * Div used to display ad controls.
     */
    var controlsDiv;

    /**
     * Div used to display ad countdown timer.
     */
    var countdownDiv;

    /**
     * Div used to display add seek bar.
     */
    var seekBarDiv;

    /**
     * Div used to display ad progress (in seek bar).
     */
    var progressDiv;

    /**
     * Div used to display ad play/pause button.
     */
    var playPauseDiv;

    /**
     * Div used to display ad mute button.
     */
    var muteDiv;

    /**
     * Div used by the volume slider.
     */
    var sliderDiv;

    /**
     * Volume slider level visuals
     */
    var sliderLevelDiv;

    /**
     * Div used to display ad fullscreen button.
     */
    var fullscreenDiv;

    /**
     * IMA SDK AdDisplayContainer.
     */
    var adDisplayContainer;

    /**
     * True if the AdDisplayContainer has been initialized. False otherwise.
     */
    var adDisplayContainerInitialized = false;

    /**
     * IMA SDK AdsLoader
     */
    var adsLoader;

    /**
     * IMA SDK AdsManager
     */
    var adsManager;

    /**
     * IMA SDK AdsRenderingSettings.
     */
    var adsRenderingSettings = null;

    /**
     * Ad tag URL. Should return VAST, VMAP, or ad rules.
     */
    var adTagUrl;

    /**
     * Current IMA SDK Ad.
     */
    var currentAd;

    /**
     * Timer used to track content progress.
     */
    var contentTrackingTimer;

    /**
     * Timer used to track ad progress.
     */
    var adTrackingTimer;

    /**
     * True if ads are currently displayed, false otherwise.
     * True regardless of ad pause state if an ad is currently being displayed.
     */
    var adsActive = false;

    /**
     * True if ad is currently playing, false if ad is paused or ads are not
     * currently displayed.
     */
    var adPlaying = false;

    /**
     * True if the ad is muted, false otherwise.
     */
    var adMuted = false;

    /**
     * True if our content video has completed, false otherwise.
     */
    var contentComplete = false;

    /**
     * True if ALL_ADS_COMPLETED has fired, false until then.
     */
     var allAdsCompleted = false;

    /**
     * Handle to interval that repeatedly updates current time.
     */
    var updateTimeIntervalHandle;

    /**
     * Handle to interval that repeatedly checks for seeking.
     */
    var seekCheckIntervalHandle;

    /**
     * Interval (ms) on which to check if the user is seeking through the
     * content.
     */
    var seekCheckInterval = 1000;

    /**
     * Threshold by which to judge user seeking. We check every 1000 ms to see
     * if the user is seeking. In order for us to decide that they are *not*
     * seeking, the content video playhead must only change by 900-1100 ms
     * between checks. Any greater change and we assume the user is seeking
     * through the video.
     */
    var seekThreshold = 100;

    /**
     * Stores data for the content playhead tracker.
     */
    var contentPlayheadTracker = {
      currentTime: 0,
      previousTime: 0,
      seeking: false,
      duration: 0
    };

    /**
     * Stores data for the ad playhead tracker.
     */
    var adPlayheadTracker = {
      currentTime: 0,
      duration: 0,
      isPod: false,
      adPosition: 0,
      totalAds: 0
    };

    /**
     * Content ended listeners passed by the publisher to the plugin. Publishers
     * should allow the plugin to handle content ended to ensure proper support
     * of custom ad playback.
     */
    var contentEndedListeners = [];

    /**
     * Content and ads ended listeners passed by the publisher to the plugin.
     * These will be called when the plugin detects that content *and all
     * ads* have completed. This differs from the contentEndedListeners in that
     * contentEndedListeners will fire between content ending and a post-roll
     * playing, whereas the contentAndAdsEndedListeners will fire after the
     * post-roll completes.
     */
     var contentAndAdsEndedListeners = [];

    /**
     * Local content ended listener for contentComplete.
     */
    var localContentEndedListener = function() {
      if (adsLoader && !contentComplete) {
        adsLoader.contentComplete();
        contentComplete = true;
      }
      for (var index in contentEndedListeners) {
        contentEndedListeners[index]();
      }
      if (allAdsCompleted) {
        for (var index in contentAndAdsEndedListeners) {
          contentAndAdsEndedListeners[index]();
        }
      }
      clearInterval(updateTimeIntervalHandle);
      clearInterval(seekCheckIntervalHandle);
      player.one('play', player.ima.setUpPlayerIntervals_);
    };

    settings = extend({}, ima_defaults, options || {});

    // Currently this isn't used but I can see it being needed in the future, so
    // to avoid implementation problems with later updates I'm requiring it.
    if (!settings['id']) {
      window.console.log('Error: must provide id of video.js div');
      return;
    }
    contentPlayer = document.getElementById(settings['id'] + '_html5_api');
    // Default showing countdown timer to true.
    showCountdown = true;
    if (settings['showCountdown'] == false) {
      showCountdown = false;
    }

    player.one('play', player.ima.setUpPlayerIntervals_);

    player.on('ended', localContentEndedListener);

    var contrib_ads_defaults = {
      debug: settings.debug,
      timeout: settings.timeout,
      prerollTimeout: settings.prerollTimeout
    };

    var ads_plugin_settings =
        extend({}, contrib_ads_defaults, options['contribAdsSettings'] || {});

    player.ads(ads_plugin_settings);

    adsRenderingSettings = new google.ima.AdsRenderingSettings();
    adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
    if (settings['adsRenderingSettings']) {
      for (var setting in settings['adsRenderingSettings']) {
        adsRenderingSettings[setting] =
            settings['adsRenderingSettings'][setting];
      }
    }

    if (settings['locale']) {
      google.ima.settings.setLocale(settings['locale']);
    }

    player.ima.createAdContainer_();

    adsLoader = new google.ima.AdsLoader(adDisplayContainer);

    adsLoader.getSettings().setVpaidMode(
        google.ima.ImaSdkSettings.VpaidMode.ENABLED);
    if (settings.vpaidAllowed == false) {
      adsLoader.getSettings().setVpaidMode(
          google.ima.ImaSdkSettings.VpaidMode.DISABLED);
    }
    if (settings.vpaidMode) {
      adsLoader.getSettings().setVpaidMode(settings.vpaidMode);
    }

    if (settings.locale) {
      adsLoader.getSettings().setLocale(settings.locale);
    }

    adsLoader.getSettings().setPlayerType('videojs-ima');
    adsLoader.getSettings().setPlayerVersion(VERSION);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      player.ima.onAdsManagerLoaded_,
      false);
    adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      player.ima.onAdsLoaderError_,
      false);

    if (!readyCallback) {
      readyCallback = player.ima.start;
    }
    player.on('readyforpreroll', readyCallback);
    player.on('fullscreenchange', player.ima.onFullscreenChange_);
    player.on('volumechange', player.ima.onVolumeChange_);
  };

  vjs.plugin('ima', imaPlugin);
}(window.videojs));

}).call(global, module, undefined, undefined);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/Users/alexanderbakum/github/example-videojs-hls-bundle/node_modules/videojs-contrib-ads/src/videojs.ads.js":2,"video.js":undefined}]},{},[1]);

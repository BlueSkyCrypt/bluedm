import Layout from "@/components/Layout";
import { useEffect, useState, useRef } from "react";
import {
  AppBskyFeedPost,
  AtpSessionData,
  AtpSessionEvent,
  BskyAgent,
  RichText,
} from "@atproto/api";
import Head from "next/head";
import { ThreadViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import {
  generateAESKey,
  generateKeys,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  encryptWithAESKey,
  decryptWithAESKey,
} from "@/services/cipher";

const Home = () => {
  const messageTextInput = useRef<HTMLInputElement>(null);
  const userHandleNameTextInput = useRef<HTMLInputElement>(null);

  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  const [activeAgent, setActiveAgent] = useState<BskyAgent | null>(null);

  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [userID, setUserID] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [userHandle, setUserHandle] = useState<string | null>("");

  const [isSendingStartMessage, setIsSendingStartMessage] =
    useState<boolean>(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [isDMSessionStarted, setIsDMSessionStarted] = useState<boolean>(false);

  const [counterpartUserHandle, setCounterpartUserHandle] =
    useState<string>("");

  const [counterpartUserData, setCounterpartUserData] = useState<string | null>(
    null
  );
  const [cid, setCID] = useState<string | null>(null);
  const [uri, setURI] = useState<string | null>(null);

  const [messages, setMessages] = useState<SecretMessage[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isPostingMessage, setIsPostingMessage] = useState<boolean>(false);

  const [myPrivateKey, setMyPrivateKey] = useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const [counterpartPublicKey, setCounterpartPublicKey] = useState<
    string | null
  >(null);
  const [encryptedSharedKey, setEncryptedSharedKey] = useState<string | null>(
    null
  );
  const [decryptedSharedKey, setDecryptedSharedKey] = useState<string | null>(
    null
  );
  const [messagesCount, setMessagesCount] = useState<number>(0);
  const [validationResult, setValidationResult] = useState<boolean | null>(
    null
  );

  const [messagingSessions, setMessagingSessions] = useState<
    SecretMessagingSession[]
  >([]);

  const [showsDeleteKeysButton, setShowsDeleteKeysButton] =
    useState<boolean>(false);

  useEffect(() => {
    if (messages.length > messagesCount) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      setMessagesCount(messages.length);
    }
  }, [messages]);

  useEffect(() => {
    const resumeSessionIfPossible = async () => {
      try {
        const agent = await resumeSession();

        if (agent && agent.hasSession === true && agent.session?.handle) {
          console.log("User has session.", agent);
          setActiveAgent(agent);
          setIsSignedIn(true);

          const myProfileURL = `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${agent.session.handle}&collection=app.bsky.actor.profile&rkey=self`;

          const myProfileResponse = await fetch(myProfileURL);
          const myProfileData = await myProfileResponse.text();
          const myProfileDataObj = JSON.parse(myProfileData);

          await processKeys(agent, myProfileDataObj, agent.session?.handle);

          if (counterpartUserHandle.length > 0) {
            const url = `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${counterpartUserHandle}&collection=app.bsky.actor.profile&rkey=self`;

            const profileResponse = await fetch(url);
            const profileData = await profileResponse.text();

            if (!profileData || typeof profileData !== "string") {
              throw new Error("User does not exist.");
            }

            setCounterpartUserData(JSON.stringify(profileData, null, 2));

            const counterpartUserDataObj = JSON.parse(profileData);
            const counterpartUserPublicKey =
              counterpartUserDataObj["value"]["bluedmPublicKey"];

            // const counterpartUserVersion =
            //   counterpartUserDataObj["value"]["bluedmVersion"];

            setCounterpartPublicKey(counterpartUserPublicKey);
          }

          if (agent.session?.handle) {
            setUserID(agent.session?.handle);
            setUserHandle(agent.session?.handle);
          }
        } else {
          setActiveAgent(null);
          setIsSignedIn(false);
        }
      } catch (error) {
        console.error(error);
        setActiveAgent(null);
        setIsSignedIn(false);
      }
    };

    resumeSessionIfPossible();
  }, []);

  useEffect(() => {
    const timerID = setInterval(() => {
      console.log("Timer running...");

      if (isSignedIn === false) {
        console.log("Not signed in...");
        return;
      }

      const checkMessage = async () => {
        if (
          activeAgent &&
          activeAgent?.hasSession === true &&
          myPublicKey &&
          myPrivateKey
        ) {
          if (!cid || !uri) {
            console.log("Waiting for counterpart...");
            const response = await activeAgent.listNotifications();

            let sessions: SecretMessagingSession[] = [];

            const notifications = response.data.notifications;

            for (const notification of notifications) {
              try {
                if (notification.reason === "mention") {
                  const record = notification.record as any;

                  const sharedKey = record["bluedmSharedKey"];
                  const bluedmVersion = record["bluedmVersion"];

                  if (
                    !bluedmVersion ||
                    typeof bluedmVersion !== "number" ||
                    bluedmVersion < 1.0
                  ) {
                    continue;
                  }

                  if (
                    !sharedKey ||
                    typeof sharedKey !== "string" ||
                    sharedKey.length === 0
                  ) {
                    continue;
                  }

                  const url = `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${notification.author.handle}&collection=app.bsky.actor.profile&rkey=self`;

                  const profileResponse = await fetch(url);
                  const profileData = await profileResponse.text();

                  if (!profileData || typeof profileData !== "string") {
                    throw new Error("User does not exist.");
                  }

                  let decryptedKey: string | null = null;

                  try {
                    decryptedKey = decryptWithPrivateKey(
                      sharedKey,
                      myPrivateKey
                    );
                  } catch (error) {
                    console.error("sharedKey", sharedKey);
                    console.error(error);
                  }

                  if (!decryptedKey) {
                    throw new Error("Shared key decryption failed.");
                  }

                  let session: SecretMessagingSession = {
                    notificationData: notification,
                    encryptedSharedkey: sharedKey,
                    counterUserProfileData: profileData,
                    sharedKey: decryptedKey,
                  };

                  sessions.push(session);
                }
              } catch (error) {
                console.error(error);
              }
            }

            setMessagingSessions([...sessions]);
            console.log(sessions);

            return;
          }

          console.log("Waiting for message...");

          const response = await activeAgent.getPostThread({ uri });
          const replies = (response.data.thread as ThreadViewPost).replies;

          if (
            replies &&
            replies.length > 0 &&
            myPrivateKey &&
            typeof myPrivateKey === "string" &&
            decryptedSharedKey
          ) {
            let posts: SecretMessage[] = [];

            for (const reply of replies) {
              let message = reply.post as SecretMessage;

              try {
                message.decryptedMessage = decryptWithAESKey(
                  message.record.bluedmSecretMessage,
                  decryptedSharedKey
                );
              } catch (error) {
                console.error(error);
                message.decryptedMessage = "Decryption failed.";
              }

              const date = new Date(message.record.createdAt as string);
              date.setFullYear(date.getFullYear() + 100);
              message.sentAt = new Date(date).toISOString();

              if (message.author.handle === userID) {
                message.isMe = true;
              } else {
                message.isMe = false;
              }

              posts.push(message);
            }

            posts.sort((a: SecretMessage, b: SecretMessage) => {
              return (
                new Date(a.record.createdAt as string).getTime() -
                new Date(b.record.createdAt as string).getTime()
              );
            });

            setMessages(posts);
          }
        }
      };

      checkMessage();
    }, 1000);

    return () => {
      if (timerID) {
        clearInterval(timerID);
      }
    };
  }, [activeAgent, isSignedIn, uri, myPrivateKey]);

  useEffect(() => {
    if (!myPublicKey || !myPrivateKey) {
      setValidationResult(false);
      return;
    }

    try {
      const testMessage = generateAESKey();
      const encryptedMessage = encryptWithPublicKey(testMessage, myPublicKey);
      const decryptedMessage = decryptWithPrivateKey(
        encryptedMessage,
        myPrivateKey
      );

      if (testMessage === decryptedMessage) {
        setValidationResult(true);
      } else {
        setValidationResult(false);
      }
    } catch (error) {
      setValidationResult(false);
      console.error(error);
    }
  }, [myPublicKey, myPrivateKey]);

  const handleSubmitSignIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSigningIn(true);

    const signIn = async () => {
      try {
        const agent = new BskyAgent({
          service: "https://bsky.social",
          persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
            if (sess) {
              sessionStorage.setItem("bsky_session_data", JSON.stringify(sess));
            }
          },
        });

        const result = await agent.login({
          identifier: userID,
          password: password,
        });

        if (isDemoMode) {
          sessionStorage.setItem("current_mode", "demo");
        } else {
          sessionStorage.setItem("current_mode", "normal");
        }

        if (result.success === true) {
          setActiveAgent(agent);

          const url = `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${userID}&collection=app.bsky.actor.profile&rkey=self`;

          const profileResponse = await fetch(url);
          const profileData = await profileResponse.text();
          const profileDataObj = JSON.parse(profileData);

          await processKeys(agent, profileDataObj, userID);

          setIsSignedIn(true);
        } else {
          setIsSignedIn(false);
        }
      } catch (error) {
        console.error(error);
        setIsSignedIn(false);
      }

      setIsSigningIn(false);

      setTimeout(() => {
        userHandleNameTextInput.current?.focus();
      }, 200);
    };

    signIn();
  };

  const handleUserIDChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserID(event.target.value);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleDemoModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsDemoMode(event.target.checked);
  };

  const handleCounterpartUserHandleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCounterpartUserHandle(event.target.value);
  };

  const handleClickStartSendingMessage = () => {
    setIsSendingStartMessage(true);

    const submitMessage = async () => {
      try {
        const agent = await resumeSession();

        if (!agent) {
          throw new Error("Resume session failed.");
        }

        const url = `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${counterpartUserHandle}&collection=app.bsky.actor.profile&rkey=self`;

        const profileResponse = await fetch(url);
        const profileData = await profileResponse.text();

        if (!profileData || typeof profileData !== "string") {
          throw new Error("User does not exist.");
        }

        const counterpartUserDataObj = JSON.parse(profileData);

        const counterpartPublicKey =
          counterpartUserDataObj["value"]["bluedmPublicKey"];

        if (!counterpartPublicKey || typeof counterpartPublicKey !== "string") {
          throw new Error(
            `${counterpartUserHandle}' does not have public key.`
          );
        }

        const counterpartVersion =
          counterpartUserDataObj["value"]["bluedmVersion"];

        if (
          !counterpartVersion ||
          typeof counterpartVersion !== "number" ||
          counterpartVersion < 1.0
        ) {
          throw new Error(
            `${counterpartUserHandle}' does not use compatible version.`
          );
        }

        setCounterpartPublicKey(counterpartPublicKey);

        const sharedKey = generateAESKey();
        setDecryptedSharedKey(sharedKey);

        const encryptedSharedKey = encryptWithPublicKey(
          sharedKey,
          counterpartPublicKey
        );

        setEncryptedSharedKey(encryptedSharedKey);

        setCounterpartUserData(JSON.stringify(counterpartUserDataObj, null, 2));

        const startText = `@${counterpartUserHandle} Let's DM ✉️!`;

        const richText = new RichText({ text: startText });
        await richText.detectFacets(agent);

        const today = new Date();
        const dateStr = today.toISOString();

        const postObj: AppBskyFeedPost.Record = {
          $type: "app.bsky.feed.post",
          text: startText,
          facets: richText.facets,
          createdAt: dateStr,
          bluedmSharedKey: encryptedSharedKey,
          bluedmVersion: 1.0,
        };

        const result = await agent.post(postObj);

        setCID(result.cid);
        setURI(result.uri);

        setStartMessage(JSON.stringify(postObj, null, 2));

        setIsDMSessionStarted(true);

        console.log(result);
      } catch (error) {
        console.error(error);
      }

      setIsSendingStartMessage(false);

      setTimeout(() => {
        messageTextInput.current?.focus();
        window.scrollTo(0, document.documentElement.scrollHeight);
      }, 200);
    };

    submitMessage();
  };

  const processKeys = async (
    agent: BskyAgent,
    profileDataObj: any,
    userID: string
  ) => {
    const existingPublicKey = profileDataObj["value"]["bluedmPublicKey"];
    const existingPrivateKey = localStorage.getItem(
      `bluedmPrivateKey:${userID}`
    );

    if (
      !existingPublicKey ||
      typeof existingPublicKey !== "string" ||
      !existingPrivateKey ||
      typeof existingPrivateKey !== "string"
    ) {
      console.log("Renew keys.");

      const keys = generateKeys();

      setMyPrivateKey(keys.privateKey);
      setMyPublicKey(keys.publicKey);

      localStorage.setItem(`bluedmPrivateKey:${userID}`, keys.privateKey);

      await agent.upsertProfile((existing) => {
        let updateData = existing || {};
        updateData["bluedmPublicKey"] = keys.publicKey;
        updateData["bluedmVersion"] = 1.0;

        return updateData;
      });
    } else {
      console.log(`Use existing keys for ${userID}.`);

      setMyPrivateKey(existingPrivateKey);
      setMyPublicKey(existingPublicKey);
    }
  };

  const resumeSession = async (): Promise<BskyAgent | null> => {
    const agent = new BskyAgent({
      service: "https://bsky.social",
    });

    const sessionDataStr = sessionStorage.getItem("bsky_session_data");

    if (!sessionDataStr || typeof sessionDataStr !== "string") {
      setIsSignedIn(false);
      setActiveAgent(null);
      return null;
    }

    const currentMode = sessionStorage.getItem("current_mode");

    if (
      currentMode &&
      typeof currentMode === "string" &&
      currentMode === "demo"
    ) {
      setIsDemoMode(true);
    }

    const sessionData = JSON.parse(sessionDataStr);

    try {
      await agent.resumeSession(sessionData);
    } catch (error) {
      console.error(error);
    }

    return agent;
  };

  const handleMeessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(event.target.value);
  };

  const handleSessionClick = async (session: SecretMessagingSession) => {
    if (!activeAgent) {
      return;
    }

    const notification = session.notificationData;

    setDecryptedSharedKey(session.sharedKey);

    const counterpartUserDataObj = JSON.parse(session.counterUserProfileData);

    const counterpartUserPublicKey =
      counterpartUserDataObj["value"]["bluedmPublicKey"];

    setCounterpartUserHandle(notification.author.handle);

    setCounterpartPublicKey(counterpartUserPublicKey);

    setCounterpartUserData(
      JSON.stringify(session.counterUserProfileData, null, 2)
    );

    setEncryptedSharedKey(session.encryptedSharedkey);

    await activeAgent.updateSeenNotifications();

    setCID(notification.cid);
    setURI(notification.uri);
    setIsDMSessionStarted(true);
  };

  const handleClickPostMessage = () => {
    if (!activeAgent || !cid || !uri || message.trim().length === 0) {
      return;
    }

    setIsPostingMessage(true);

    const postMessage = async () => {
      try {
        const messageText = `DMing...✉️`;

        const richText = new RichText({ text: messageText });
        await richText.detectFacets(activeAgent);

        const today = new Date();
        const hundredYearsAgo = new Date(today);
        hundredYearsAgo.setFullYear(today.getFullYear() - 100);
        const dateStr = hundredYearsAgo.toISOString();

        if (!counterpartPublicKey || typeof counterpartPublicKey !== "string") {
          throw new Error("Counterpart has no public key.");
        }

        if (!decryptedSharedKey) {
          throw new Error("You don't have shared key.");
        }

        const bluedmSecretMessage = encryptWithAESKey(
          message,
          decryptedSharedKey
        );

        const postObj: AppBskyFeedPost.Record = {
          $type: "app.bsky.feed.post",
          text: messageText,
          facets: richText.facets,
          createdAt: dateStr,
          bluedmVersion: 1.0,
          bluedmSecretMessage,
          reply: {
            root: {
              cid: cid,
              uri: uri,
            },
            parent: {
              cid: cid,
              uri: uri,
            },
          },
        };

        const result = await activeAgent.post(postObj);

        console.log(result);
      } catch (error) {
        console.error(error);
      }
    };

    setIsPostingMessage(false);
    setMessage("");

    postMessage();
  };

  const handleClickReset = async () => {
    if (!activeAgent) {
      return;
    }

    const keys = generateKeys();

    setMyPrivateKey(keys.privateKey);
    setMyPublicKey(keys.publicKey);

    localStorage.setItem(`bluedmPrivateKey:${userID}`, keys.privateKey);

    await activeAgent.upsertProfile((existing) => {
      let updateData = existing || {};
      updateData["bluedmPublicKey"] = keys.publicKey;
      updateData["bluedmVersion"] = 1.0;

      return updateData;
    });
  };

  const handlePostEnterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key !== "Enter") {
      return;
    }

    handleClickPostMessage();
  };

  const handleClickStartSendingMessageKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.nativeEvent.isComposing || e.key !== "Enter") {
      return;
    }

    handleClickStartSendingMessage();
  };

  const handleClickDownloadKey = () => {
    if (!myPrivateKey) {
      return;
    }

    const element = document.createElement("a");
    const file = new Blob([myPrivateKey], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "bluedmPrivateKey.pem";
    document.body.appendChild(element); // Workaround for Firefox
    element.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];

    if (file !== null) {
      try {
        const reader = new FileReader();

        reader.onload = (event) => {
          if (
            event.target &&
            event.target.result &&
            typeof event.target.result === "string"
          ) {
            localStorage.setItem(
              `bluedmPrivateKey:${userID}`,
              event.target.result
            );
            setMyPrivateKey(event.target.result);
            alert("Imported private key from file.");
          } else {
            alert("Invalid file content.");
          }
        };

        reader.readAsText(file);
      } catch (error) {
        alert("Unknown error occurred.");
        console.error(error);
      }
    }
  };

  const handleClickShowsDeleteKeys = () => {
    setShowsDeleteKeysButton(true)    
  }

  const handleClickDeleteKeys = async () => {
    if (!activeAgent) {
      return;
    }

    localStorage.removeItem(`bluedmPrivateKey:${userID}`);

    await activeAgent.upsertProfile((existing) => {
      let updateData = existing || {};

      delete updateData.bluedmPublicKey;
      delete updateData.bluedmVersion;

      return updateData;
    });

    sessionStorage.clear();

    setIsSignedIn(false);

    alert("Your keys are deleted.");
  };

  return (
    <>
      <Head>
        <title>Blue DM</title>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
        />
      </Head>

      <Layout>
        {isSignedIn === false && (
          <form onSubmit={handleSubmitSignIn}>
            <div className="field">
              <div className="control">
                <input
                  autoFocus
                  className="input"
                  type="text"
                  value={userID}
                  placeholder="e.g. some-user.bsky.social"
                  onChange={handleUserIDChange}
                />
              </div>
            </div>

            <div className="field">
              <div className="control">
                <input
                  className="input"
                  type="password"
                  value={password}
                  placeholder="password"
                  onChange={handlePasswordChange}
                />
              </div>
            </div>

            <div className="field">
              <div className="control">
                <button
                  className={`button is-primary ${
                    isSigningIn ? "is-loading" : ""
                  }`}
                  type="submit"
                >
                  Sign in
                </button>
              </div>
            </div>

            <div className="field">
              <div className="control">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={isDemoMode}
                    onChange={handleDemoModeChange}
                  />
                  &nbsp; Use demo mode
                </label>
              </div>
            </div>
          </form>
        )}

        {isSignedIn && (
          <div className="mb-5">
            <h3 className="is-size-5">{`Welcome, ${userHandle || userID}.`}</h3>
          </div>
        )}

        {isSignedIn && (
          <div>
            <div>
              {isDMSessionStarted === false && validationResult === true && (
                <div className="field has-addons">
                  <div className="control is-expanded">
                    <input
                      ref={userHandleNameTextInput}
                      className="input"
                      type="text"
                      value={counterpartUserHandle}
                      placeholder="e.g. some-user.bsky.social"
                      onKeyDown={handleClickStartSendingMessageKeyDown}
                      onChange={handleCounterpartUserHandleChange}
                    />
                  </div>
                  <div className="control">
                    <button
                      className={`button is-primary ${
                        isSendingStartMessage ? "is-loading" : ""
                      }`}
                      onClick={handleClickStartSendingMessage}
                    >
                      Send DM Request
                    </button>
                  </div>
                </div>
              )}

              {isDemoMode && myPublicKey && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>My public key</p>
                  </div>
                  <div className="message-body scrollable">{myPublicKey}</div>
                </article>
              )}

              {isDemoMode && myPrivateKey && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>My private key</p>
                  </div>
                  <div className="message-body scrollable">{myPrivateKey}</div>
                </article>
              )}

              {isDemoMode && validationResult === true && (
                <article className="message is-success mt-5">
                  <div className="message-header">
                    <p>Validation result</p>
                  </div>
                  <div className="message-body scrollable">
                    Valid public key and private key pair.
                  </div>
                </article>
              )}

              {isDemoMode && counterpartUserData && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>com.atproto.repo.getRecord</p>
                  </div>
                  <div className="message-body scrollable">
                    {counterpartUserData}
                  </div>
                </article>
              )}

              {isDemoMode && startMessage && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>AppBskyFeedPost.Record</p>
                  </div>
                  <div className="message-body scrollable">{startMessage}</div>
                </article>
              )}

              {isDemoMode && encryptedSharedKey && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>Encrypted shared key</p>
                  </div>
                  <div className="message-body scrollable">
                    {encryptedSharedKey}
                  </div>
                </article>
              )}

              {isDemoMode && decryptedSharedKey && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>Shared key</p>
                  </div>
                  <div className="message-body scrollable">
                    {decryptedSharedKey}
                  </div>
                </article>
              )}

              {isDemoMode && validationResult === false && (
                <article className="message is-danger mt-5">
                  <div className="message-header">
                    <p>Validation result</p>
                  </div>
                  <div className="message-body scrollable">
                    Invalid public key and private key pair.
                  </div>
                </article>
              )}

              {isDemoMode === false && validationResult === false && (
                <article className="message is-danger mt-5">
                  <div className="message-header">
                    <p>Error</p>
                  </div>
                  <div className="message-body scrollable">
                    Please reset your keys, or import a valid private key.
                  </div>
                </article>
              )}

              {isDemoMode && counterpartPublicKey && (
                <article className="message is-primary mt-5">
                  <div className="message-header">
                    <p>Counterpard public key</p>
                  </div>
                  <div className="message-body scrollable">
                    {counterpartPublicKey}
                  </div>
                </article>
              )}
            </div>

            {counterpartUserData && (
              <div className="notification is-primary mt-5">
                <div className="is-size-4">{`✉️ ${counterpartUserHandle}`}</div>
              </div>
            )}

            {!isDMSessionStarted && validationResult === true && (
              <div className="has-text-centered mt-6 mb-6">
                <div
                  className="loader"
                  style={{ marginLeft: "auto", marginRight: "auto" }}
                ></div>
              </div>
            )}

            <div className="column">
              {isDMSessionStarted === false &&
                messagingSessions.length > 0 &&
                validationResult === true && (
                  <div>
                    {messagingSessions.map((session, index) => (
                      <div
                        key={index}
                        onClick={() => handleSessionClick(session)}
                        className={`notification notification-link ${
                          session.notificationData.isRead ? "" : "is-danger"
                        }`}
                      >
                        <div className="is-size-4">
                          {`✉️ ${session.notificationData.author.handle}`}
                        </div>
                        <div className="mb-4">
                          {session.notificationData.indexedAt}
                        </div>
                        {isDemoMode && (
                          <div className="break-word has-text-grey-light">
                            {session.encryptedSharedkey}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="column">
              {messages &&
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`card mb-2 bubble ${
                      message.isMe ? "bubble-right" : "bubble-left"
                    }`}
                  >
                    <div className="card-content">
                      <div className="media">
                        <div className="media-left">
                          <figure className="image is-48x48 avatar">
                            {message.author.avatar && (
                              <img src={message.author.avatar} />
                            )}
                          </figure>
                        </div>
                        <div className="media-content">
                          <div className="mt-3">
                            <span className="has-text-weight-bold">
                              {message.author.displayName}
                            </span>
                            <span className="has-text-weight-bold has-text-grey">{` @ ${message.author.handle}`}</span>
                          </div>
                        </div>
                      </div>
                      <div className="content">
                        <div className="mb-2">{message.decryptedMessage}</div>
                        <div className="has-text-grey">{message.sentAt}</div>
                        {isDemoMode && (
                          <div>
                            <hr />
                            <div className="has-text-grey-light break-word">
                              {message.record.bluedmSecretMessage}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {isDMSessionStarted && (
              <div className="has-text-centered mt-6 mb-6">
                <div
                  className="loader"
                  style={{ marginLeft: "auto", marginRight: "auto" }}
                ></div>
              </div>
            )}

            {isDMSessionStarted === true && (
              <div className="field has-addons">
                <div className="control is-expanded">
                  <input
                    ref={messageTextInput}
                    className="input"
                    type="text"
                    value={message}
                    placeholder="your message"
                    onKeyDown={handlePostEnterKeyDown}
                    onChange={handleMeessageChange}
                  />
                </div>
                <div className="control">
                  <button
                    className={`button is-primary ${
                      isPostingMessage ? "is-loading" : ""
                    }`}
                    onClick={handleClickPostMessage}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {isDMSessionStarted === false && (
              <div>
                <hr />

                <div className="is-flex is-flex-wrap-wrap">
                  <div className="field mr-4">
                    <div className="control">
                      <button
                        className={`button is-danger`}
                        onClick={handleClickReset}
                      >
                        Reset keys
                      </button>
                    </div>
                  </div>

                  {myPrivateKey && (
                    <div className="field mr-4">
                      <div className="control">
                        <button
                          className={`button`}
                          onClick={handleClickDownloadKey}
                        >
                          Download private key
                        </button>
                      </div>
                    </div>
                  )}

                  {myPublicKey && (
                    <div className="file">
                      <label className="file-label">
                        <input
                          className="file-input"
                          type="file"
                          accept=".pem"
                          onChange={handleImportFileChange}
                        />
                        <span className="file-cta">
                          <span className="file-label">
                            Import private key...
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <hr />

                <div className="field">
                  <div className="control">
                    <button
                      className={`button`}
                      onClick={handleClickShowsDeleteKeys}
                    >
                      Stop using this service
                    </button>
                  </div>
                </div>

                {showsDeleteKeysButton && (
                  <div className="field">
                    <div className="control">
                      <button
                        className={`button is-danger`}
                        onClick={handleClickDeleteKeys}
                      >
                        Delete keys and sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Layout>
    </>
  );
};

export default Home;

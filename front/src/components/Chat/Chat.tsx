import { useEffect, useMemo, useState } from "react";
import { ChatPropsType } from "../../@types/types";
import styles from "./chat.module.css";
import { MessageInterface } from "../../@types/interfaces/messageInterface";

function Chat(props: ChatPropsType) {
  const { socket, messages } = props;
  const [visible, setvisible] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const allMessages = useMemo(() => messages, [messages]);
  const [messagesReads, setMessagesReads] = useState(0);

  useEffect(() => {
    if (visible) {
      setMessagesReads(messages.length);
    }
  }, [visible, messages]);

  const sendMessage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (messageContent === "") {
      return;
    }
    const username = localStorage.getItem("username") || "Anonyme";
    socket.emit("createMessage", messageContent, username);
    setMessageContent("");
  };

  return (
    <div className={`${styles.chat} ${!visible ? styles.animate : ""}`}>
      <div>
        <div onClick={() => setvisible(!visible)}>
          {!visible ? (
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAABjElEQVR4nO2ZTUrEQBCFs/IYOi7c66AnGPU8bsSda0+gIyTvpbMRcgCPIviDzJitQZz1wEjhBBrHQDoJSUfrQe/SqfdVV6eTShCoVCqVtyI5AnBLMgOwJLnqYuA7VkZyKh5qmY/j+JTkoivTLB8LACdO5pMk2fXE/Gq9Ip9hGO5UBliXTXGDGclJmqZbQUM1hLhxCZRZkydNjbcEMK8cyN6wbWS+JYBlrUBtmW8KQBcvClAiXYGq0hIaSgkBGAN4BfAop/egAACMSebWtWeDAcCm+bzKu4oXACT3AbxbJ+RHGIaHrvftBcAYc/Aj8wJwT/KqZFwC2PMGAMCLa1DZ5N4AkHyuEfjJ9xK6A3Dx25Ank725ewco28QAjoIK8gKgZCXywR1kZhPifFAABQSAB/luth+XgwFwlQJUla5AibSE/k0J4Q80tt6KiVEUHfsAQHLmEmhqT5T2dt/NXZLXLoFGvrXXjTHbTtmSrMtEH8zD9QdHIXmXl768tLa7/sUEYC5l45x5lUqlCrrUF4vAzbx2oehjAAAAAElFTkSuQmCC"></img>
          ) : (
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAABh0lEQVR4nO2ZQUrEMBSGu/IYThV0PYI3GPU+utCda0+gIyT/33Qj9ADexIUj4ozdKuKsB0aCHQjDVJq21FTfD1m+vv9LXpvmJYpEIpEoWJGMAdySzAEsSC67GPjOlZMcWw+1zCdJckJy3pVplo85gGMv82ma7gRiflmsyKdSalAZoCib1QOmJEdZlm1FDdUQ4sYnUe4Ej5oabwlgVjmR+8K2MfMtASxqJWrLfFMA+ngRgBLJClSVlFDfSkhrvUvyieSzMeagdwAAzpyY9zKIYAGUUgNr3Nl03jZBBAtgRXJojTsQH0qpwygkAGPMPslLklebBoD7te3fAg2DAQDwUiPxJBgAkhPfpAAeQwKItdanAC5Kxl3QJdT7l/inI+ia+X59Rkme93ojA7BXnJ0fevkrUVUCUFWyAiWSEvo3JYQ/0Nh6XQVqrY9CACA59Uk0dgNte/u3m7skr30SxaG1140x216zZWfdBoZgHr4XHO5h3fblbWu76ysmADNbNt4zLxKJRFGX+gL9Lc2ymHuLogAAAABJRU5ErkJggg=="></img>
          )}
          {messages.length - messagesReads > 0 && (
            <div className={styles.messagesUnread}>
              {messages.length - messagesReads}
            </div>
          )}
        </div>
      </div>
      <div className={styles.chatPage}>
        <div>
          {messages.length !== 0 &&
            messages.map((message) => (
              <div
                key={message.date}
                className={`${styles.message} ${
                  message.socketId === socket.id
                    ? styles.userMessage
                    : message.socketId
                    ? styles.otherMessage
                    : styles.serverMessage
                }`}
              >
                <div>
                  <small>{message.username}</small>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
        </div>
        <form>
          <input
            type="text"
            value={messageContent}
            placeholder="Votre message"
            onInput={(e) =>
              setMessageContent((e.target as HTMLInputElement).value)
            }
          />
          <button className={styles.button} onClick={(e) => sendMessage(e)}>
            <div>
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                >
                  <path fill="none" d="M0 0h24v24H0z"></path>
                  <path
                    fill="currentColor"
                    d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z"
                  ></path>
                </svg>
              </div>
            </div>
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;

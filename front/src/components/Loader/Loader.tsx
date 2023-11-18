import { useEffect, useState } from "react";
import styles from "./loader.module.css";
import { LoaderPropsType } from "../../@types/types";

function Loader(props: LoaderPropsType) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 250);
  }, []);

  return (
    <>
      {show && (
        <div
          className={`${props.absolute ? styles.absolute : styles.wrapper} ${
            styles.center
          }`}
        >
          <div className={styles.honeycomb}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
          {props.children && <>{props.children}</>}
        </div>
      )}
    </>
  );
}

export default Loader;

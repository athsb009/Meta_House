// src/components/AnimatedBackground.jsx
import React from "react";
import { motion } from "framer-motion";

const AnimatedBackground = () => {
  return (
    <motion.div
      className="absolute top-0 left-0 w-full h-full z-[-1]"
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      style={{
        background: "linear-gradient(135deg, #667eea, #764ba2)",
      }}
    />
  );
};

export default AnimatedBackground;

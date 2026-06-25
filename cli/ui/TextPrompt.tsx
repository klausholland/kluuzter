import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export default function TextPrompt(props: {
  label: string;
  onSubmit: (value: string) => void;
}): React.ReactElement {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.return) props.onSubmit(value);
    else if (key.backspace || key.delete) setValue((v) => v.slice(0, -1));
    else if (input && !key.ctrl && !key.meta) setValue((v) => v + input);
  });

  return (
    <Box>
      <Text bold>{props.label} </Text>
      <Text color="cyan">{value}</Text>
      <Text>▏</Text>
    </Box>
  );
}

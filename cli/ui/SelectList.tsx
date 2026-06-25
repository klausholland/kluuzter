import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type SelectItem<T> = { label: string; value: T };

export default function SelectList<T>(props: {
  items: SelectItem<T>[];
  onSelect: (value: T) => void;
  label?: string;
}): React.ReactElement {
  const [index, setIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) setIndex((i) => (i > 0 ? i - 1 : props.items.length - 1));
    else if (key.downArrow) setIndex((i) => (i + 1) % props.items.length);
    else if (key.return && props.items[index]) props.onSelect(props.items[index].value);
  });

  return (
    <Box flexDirection="column">
      {props.label ? <Text bold>{props.label}</Text> : null}
      {props.items.map((item, i) => (
        <Text key={i} color={i === index ? "cyan" : undefined}>
          {i === index ? "❯ " : "  "}{item.label}
        </Text>
      ))}
    </Box>
  );
}

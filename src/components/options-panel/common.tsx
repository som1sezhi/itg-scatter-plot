import NumberField from "../NumberField";
import {
  type SelectProps,
  type SliderProps,
  Box,
  FormControl,
  InputLabel,
  Select,
  Slider,
} from "@mui/material";
import type { NumberFieldProps } from "../NumberField";
import { useId } from "react";

export function Slider0To1(props: SliderProps) {
  return (
    <Box sx={{ px: "8px" }}>
      <Slider min={0} max={1} step={0.01} {...props} />
    </Box>
  );
}

export function NumberField0To100(props: NumberFieldProps) {
  return <NumberField size="small" min={0} max={100} step={1} {...props} />;
}

export function CommonSelect<T>({ label, children, ...props }: SelectProps<T>) {
  const labelId = useId();
  const selectId = useId();
  return (
    <FormControl>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        id={selectId}
        label={label}
        size="small"
        sx={{ mb: 1 }}
        {...props}
      >
        {children}
      </Select>
    </FormControl>
  );
}

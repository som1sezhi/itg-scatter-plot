import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import type { DataPoint } from "../types";

export default function AboutDialog({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: DataPoint[];
}) {
  return (
    <Dialog onClose={onClose} aria-labelledby="about-dialog-title" open={open}>
      <DialogTitle sx={{ m: 0, p: 2 }} id="about-dialog-title">
        About
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={(theme) => ({
          position: "absolute",
          right: 8,
          top: 8,
          color: theme.palette.grey[500],
        })}
      >
        <Close />
      </IconButton>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography gutterBottom>
            This app visualizes ITG stamina charts on a scatter plot. The X axis
            represents the stream BPM, the Y axis represents the total number of
            stream measures, and the color represents the difficulty rating. You
            can also filter points on the graph by stream density.
          </Typography>
          <Typography gutterBottom>
            The app allows you to compare your own chart with the charts on this
            plot with using the "Add a point" section in the options panel. You
            can either type in the chart's BPM/total stream/density, paste in
            the full stream breakdown, or upload a simfile. Your chart will show
            up in the chart as a black dot with a ring around it (unless it
            falls outside the current density filter range, in which case it
            will be greyed out).
          </Typography>
          <Typography gutterBottom>
            The dataset currently consists of the SRPG6/7/8/9/10 base packs
            (excluding DPRT), the ECS11/12/13/14 packs, the SRPG6 NNP unlocks,
            and a few super long marathons. Some charts may be rerated in packs
            that are not any of the above; those reratings are not reflected
            here.
          </Typography>
          <Typography gutterBottom>
            The source code can be found{" "}
            <Link href="https://github.com/som1sezhi/itg-scatter-plot">
              here
            </Link>
            .
          </Typography>

          <Typography gutterBottom>
            Statistics: {data.length} data points loaded
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
